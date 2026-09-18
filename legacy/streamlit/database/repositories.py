"""Reusable parameterised SQLite repository functions."""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from typing import Any

from database.connection import connection_scope, transaction
from database.schema import APPLICATION_TABLES, quote_identifier, table_columns


def _validate_table(table: str) -> None:
    if table not in APPLICATION_TABLES:
        raise ValueError(f"Unknown table: {table}")


def _validate_columns(table: str, columns: Iterable[str]) -> None:
    _validate_table(table)
    with connection_scope() as connection:
        available = table_columns(connection, table)
    unknown = set(columns).difference(available)
    if unknown:
        raise ValueError(f"Unknown columns for {table}: {', '.join(sorted(unknown))}")


def get_all_records(table: str, order_by: str | None = None) -> list[dict[str, Any]]:
    _validate_table(table)
    sql = f"SELECT * FROM {quote_identifier(table)}"
    if order_by:
        _validate_columns(table, [order_by])
        sql += f" ORDER BY {quote_identifier(order_by)}"
    with connection_scope() as connection:
        return [dict(row) for row in connection.execute(sql).fetchall()]


def get_record_by_id(table: str, record_id: Any, id_column: str = "_row_id") -> dict[str, Any] | None:
    _validate_columns(table, [id_column])
    sql = f"SELECT * FROM {quote_identifier(table)} WHERE {quote_identifier(id_column)} = ?"
    with connection_scope() as connection:
        row = connection.execute(sql, (record_id,)).fetchone()
    return dict(row) if row else None


def filtered_query(table: str, filters: Mapping[str, Any], order_by: str | None = None) -> list[dict[str, Any]]:
    _validate_columns(table, filters.keys())
    clauses: list[str] = []
    parameters: list[Any] = []
    for column, value in filters.items():
        if isinstance(value, (list, tuple, set)):
            values = list(value)
            if not values:
                continue
            clauses.append(f"{quote_identifier(column)} IN ({','.join('?' for _ in values)})")
            parameters.extend(values)
        elif value is None:
            clauses.append(f"{quote_identifier(column)} IS NULL")
        else:
            clauses.append(f"{quote_identifier(column)} = ?")
            parameters.append(value)
    sql = f"SELECT * FROM {quote_identifier(table)}"
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    if order_by:
        _validate_columns(table, [order_by])
        sql += f" ORDER BY {quote_identifier(order_by)}"
    with connection_scope() as connection:
        return [dict(row) for row in connection.execute(sql, parameters).fetchall()]


def insert_record(table: str, record: Mapping[str, Any]) -> int:
    _validate_columns(table, record.keys())
    columns = list(record)
    sql = (
        f"INSERT INTO {quote_identifier(table)} "
        f"({','.join(quote_identifier(column) for column in columns)}) "
        f"VALUES ({','.join('?' for _ in columns)})"
    )
    with transaction() as connection:
        cursor = connection.execute(sql, [record[column] for column in columns])
        return int(cursor.lastrowid)


def update_record(table: str, record_id: Any, updates: Mapping[str, Any], id_column: str = "_row_id") -> int:
    _validate_columns(table, [id_column, *updates.keys()])
    assignments = [f"{quote_identifier(column)} = ?" for column in updates]
    assignments.append("updated_at = CURRENT_TIMESTAMP")
    sql = (
        f"UPDATE {quote_identifier(table)} SET {', '.join(assignments)} "
        f"WHERE {quote_identifier(id_column)} = ?"
    )
    with transaction() as connection:
        cursor = connection.execute(sql, [*updates.values(), record_id])
        return cursor.rowcount


def delete_record(table: str, record_id: Any, id_column: str = "_row_id") -> int:
    _validate_columns(table, [id_column])
    sql = f"DELETE FROM {quote_identifier(table)} WHERE {quote_identifier(id_column)} = ?"
    with transaction() as connection:
        return connection.execute(sql, (record_id,)).rowcount


def execute_transaction(statements: Sequence[tuple[str, Sequence[Any]]]) -> None:
    """Execute caller-prepared parameterised statements atomically."""
    with transaction() as connection:
        for sql, parameters in statements:
            connection.execute(sql, parameters)


def get_vessels() -> list[dict]: return get_all_records("vessels")
def get_voyages() -> list[dict]: return get_all_records("voyages")
def get_anomalies() -> list[dict]: return get_all_records("anomalies")
def get_maintenance_assets() -> list[dict]: return get_all_records("maintenance_assets")
def get_safety_events() -> list[dict]: return get_all_records("safety_events")
def get_automation_tasks() -> list[dict]: return get_all_records("automation_tasks")
def get_action_history() -> list[dict]: return get_all_records("action_history")

