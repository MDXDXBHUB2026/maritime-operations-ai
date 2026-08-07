import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, MapPin, Navigation, Train, Building2, ShoppingBag, Compass, Check, Crosshair, Star, Sparkles } from 'lucide-react';
import { LocationItem, LocationId, UserPreferences, SelectedJourneyLog } from '../../types';
import { translations } from '../../data/translations';
import { backdropVariants, bottomSheetVariants } from '../../theme/motion';
import { analyzeFavoriteDestinations } from '../../utils/historyAnalysis';

interface LocationBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'origin' | 'destination';
  locations: LocationItem[];
  selectedLocationId: LocationId;
  onSelectLocation: (id: LocationId) => void;
  prefs: UserPreferences;
  journeyLogs?: SelectedJourneyLog[];
}

type CategoryFilter = 'all' | 'metro' | 'business' | 'leisure';

export const LocationBottomSheet: React.FC<LocationBottomSheetProps> = ({
  isOpen,
  onClose,
  type,
  locations,
  selectedLocationId,
  onSelectLocation,
  prefs,
  journeyLogs = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const t = translations[prefs.language] || translations.en;
  const isRtl = prefs.language === 'ar';

  const categoryFilters: { id: CategoryFilter; labelEn: string; labelAr: string; icon: React.ReactNode }[] = [
    { id: 'all', labelEn: 'All Hubs', labelAr: 'جميع المراكز', icon: <Compass className="w-3.5 h-3.5" /> },
    { id: 'metro', labelEn: 'Metro Lines', labelAr: 'خطوط المترو', icon: <Train className="w-3.5 h-3.5" /> },
    { id: 'business', labelEn: 'Business', labelAr: 'الأعمال', icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'leisure', labelEn: 'Leisure', labelAr: 'التسوق والترفيه', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
  ];

  const favoriteDestinations = useMemo(() => {
    return analyzeFavoriteDestinations(journeyLogs, 4);
  }, [journeyLogs]);

  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      const name = isRtl ? loc.nameAr : loc.nameEn;
      const metro = loc.metroStation;
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        metro.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeCategory === 'metro') {
        return loc.metroStation.includes('Red Line') || loc.metroStation.includes('Green Line');
      }
      if (activeCategory === 'business') {
        return ['difc', 'business-bay', 'dubai-internet-city'].includes(loc.id);
      }
      if (activeCategory === 'leisure') {
        return ['dubai-mall', 'dubai-marina', 'deira-city-centre', 'jumeirah-lakes-towers'].includes(loc.id);
      }

      return true;
    });
  }, [locations, searchQuery, activeCategory, isRtl]);

  const handleSelect = (id: LocationId, locName: string) => {
    onSelectLocation(id);
    const text = type === 'origin'
      ? (isRtl ? `تم تحديد نقطة الانطلاق: ${locName}` : `Starting point selected: ${locName}`)
      : (isRtl ? `تم تحديد الوجهة: ${locName}` : `Destination selected: ${locName}`);
    setToastMessage(text);

    setTimeout(() => {
      setToastMessage(null);
      onClose();
    }, 400);
  };

  const handleUseCurrentLocation = () => {
    // Default to 'dubai-marina' as demo current location
    const defaultLoc = locations.find((l) => l.id === 'dubai-marina') || locations[0];
    handleSelect(defaultLoc.id, isRtl ? defaultLoc.nameAr : defaultLoc.nameEn);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          className="absolute inset-0 bg-[#082A32]/40 backdrop-blur-xs"
        />

        {/* Bottom Sheet */}
        <motion.div
          variants={bottomSheetVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="relative w-full max-w-md bg-white rounded-t-3xl border-t border-[#DCE6E1] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col z-10"
        >
          {/* Handle */}
          <div className="w-full pt-3 pb-2 flex justify-center cursor-grab active:cursor-grabbing">
            <div className="w-12 h-1.5 bg-[#DCE6E1] rounded-full" />
          </div>

          {/* Header */}
          <div className="px-5 pb-3 flex items-center justify-between border-b border-[#DCE6E1]/60">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  type === 'origin'
                    ? 'bg-emerald-100 text-[#087F5B]'
                    : 'bg-teal-100 text-[#082A32]'
                }`}
              >
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-base text-[#102A2E] leading-tight">
                  {type === 'origin'
                    ? isRtl
                      ? 'اختر نقطة الانطلاق'
                      : 'Select Starting Location'
                    : isRtl
                    ? 'اختر الوجهة'
                    : 'Select Destination'}
                </h2>
                <p className="text-xs text-[#607276]">
                  {isRtl ? 'المراكز الرئيسية ومحطات دبي' : 'Dubai hubs & transit nodes'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#F5F8F5] border border-[#DCE6E1] flex items-center justify-center text-[#607276] hover:text-[#102A2E] transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Confirmation Toast */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mx-5 mt-2 p-2.5 bg-[#087F5B] text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm"
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>{toastMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search Box */}
          <div className="p-4 space-y-3 border-b border-[#DCE6E1]/40 bg-[#F5F8F5]/50">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#607276] absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isRtl ? 'ابحث عن موقع أو محطة...' : 'Search location or station...'}
                className="w-full pl-10 pr-9 py-2.5 bg-white border border-[#DCE6E1] rounded-xl text-sm text-[#102A2E] placeholder-[#607276] focus:outline-none focus:ring-2 focus:ring-[#087F5B] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-[#607276] hover:text-[#102A2E]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Current Location (Demo) */}
            <button
              onClick={handleUseCurrentLocation}
              className="w-full py-2 px-3 bg-white border border-[#DCE6E1] hover:border-[#20B486] rounded-xl text-xs font-semibold text-[#087F5B] flex items-center justify-between transition-colors shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <Crosshair className="w-3.5 h-3.5 text-[#20B486]" />
                <span>{isRtl ? 'استخدام الموقع الحالي (تجريبي)' : 'Use Current Location (Demo)'}</span>
              </div>
              <span className="text-[10px] bg-emerald-100/80 text-[#087F5B] px-1.5 py-0.5 rounded font-bold">
                Dubai Marina
              </span>
            </button>

            {/* Recent Favorites Quick Select (Destination Mode Only) */}
            {type === 'destination' && favoriteDestinations.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#102A2E]">
                  <span className="flex items-center gap-1 text-[#087F5B]">
                    <Star className="w-3.5 h-3.5 fill-[#087F5B]" />
                    <span>{t.recentFavoritesTitle}</span>
                  </span>
                  <span className="text-[10px] text-[#607276] font-normal">
                    {t.recentFavoritesSubtitle}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {favoriteDestinations.map((fav) => {
                    const locName = isRtl ? fav.location.nameAr : fav.location.nameEn;
                    const isSelected = fav.location.id === selectedLocationId;

                    return (
                      <button
                        key={fav.location.id}
                        onClick={() => handleSelect(fav.location.id, locName)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold shrink-0 flex items-center gap-1.5 border transition-all ${
                          isSelected
                            ? 'bg-[#087F5B] text-white border-[#087F5B] shadow-xs'
                            : fav.isTopCommon
                            ? 'bg-[#EAF3EE] text-[#087F5B] border-[#20B486]/50 hover:bg-[#d8eadd]'
                            : 'bg-white text-[#102A2E] border-[#DCE6E1] hover:border-[#20B486]'
                        }`}
                      >
                        {fav.isTopCommon ? (
                          <Sparkles className="w-3 h-3 text-[#20B486] shrink-0" />
                        ) : (
                          <MapPin className="w-3 h-3 text-[#607276] shrink-0" />
                        )}
                        <span>{locName}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-black/5 text-[#607276]'
                          }`}
                        >
                          {fav.count} {isRtl ? 'رحلة' : 'trips'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {categoryFilters.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all ${
                      isActive
                        ? 'bg-[#087F5B] text-white shadow-xs'
                        : 'bg-white border border-[#DCE6E1] text-[#607276] hover:bg-[#EAF3EE]'
                    }`}
                  >
                    {cat.icon}
                    <span>{isRtl ? cat.labelAr : cat.labelEn}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Locations List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
            {filteredLocations.length === 0 ? (
              <div className="text-center py-8 text-[#607276] text-xs">
                {isRtl ? 'لم يتم العثور على نتائج متطابقة' : 'No matching locations found.'}
              </div>
            ) : (
              filteredLocations.map((loc) => {
                const isSelected = loc.id === selectedLocationId;
                const locName = isRtl ? loc.nameAr : loc.nameEn;

                return (
                  <button
                    key={loc.id}
                    onClick={() => handleSelect(loc.id, locName)}
                    className={`w-full p-3 rounded-2xl text-left flex items-center justify-between border transition-all ${
                      isSelected
                        ? 'bg-[#EAF3EE] border-[#087F5B] shadow-2xs'
                        : 'bg-white border-[#DCE6E1] hover:border-[#20B486] hover:bg-[#F5F8F5]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[#087F5B] text-white'
                            : 'bg-[#F5F8F5] text-[#082A32] border border-[#DCE6E1]'
                        }`}
                      >
                        <Navigation className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[#102A2E] leading-snug">
                          {locName}
                        </div>
                        <div className="text-xs text-[#607276] flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 text-[11px]">
                            <Train className="w-3 h-3 text-[#087F5B]" />
                            {loc.metroStation}
                          </span>
                          <span className="bg-[#EAF3EE] text-[#087F5B] px-1.5 py-0.2 rounded text-[10px] font-semibold">
                            {loc.zone}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[#087F5B] text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

