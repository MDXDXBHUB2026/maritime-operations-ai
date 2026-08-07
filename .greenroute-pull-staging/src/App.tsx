import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MotionConfig, AnimatePresence, motion } from 'motion/react';
import {
  LocationId,
  MobilityNeedId,
  TabType,
  UserPreferences,
  JourneyOption,
  SelectedJourneyLog,
  JourneySchedule,
} from './types';
import {
  loadPreferences,
  savePreferences,
  loadJourneyLogs,
  addJourneyLog,
  resetJourneyLogs,
} from './utils/storage';
import { calculateJourneyOptions } from './utils/journeyCalculator';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { PlanScreen } from './components/screens/PlanScreen';
import { CompareScreen } from './components/screens/CompareScreen';
import { JourneyDetailsModal } from './components/screens/JourneyDetailsModal';
import { ImpactScreen } from './components/screens/ImpactScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { LaunchSequence } from './components/LaunchSequence';
import { LOCATIONS } from './data/mockData';
import { pageVariants } from './theme/motion';

const TAB_INDEX: Record<TabType, number> = {
  plan: 0,
  compare: 1,
  impact: 2,
  profile: 3,
};

export default function App() {
  const [prefs, setPrefs] = useState<UserPreferences>(() => loadPreferences());
  const [journeyLogs, setJourneyLogs] = useState<SelectedJourneyLog[]>(() => loadJourneyLogs());

  const [activeTab, setActiveTab] = useState<TabType>('plan');
  const [direction, setDirection] = useState<number>(0);
  const prevTabRef = useRef<TabType>('plan');

  const [originId, setOriginId] = useState<LocationId>('dubai-internet-city');
  const [destinationId, setDestinationId] = useState<LocationId>('dubai-mall');
  const [mobilityNeed, setMobilityNeed] = useState<MobilityNeedId>('standard');
  const [schedule, setSchedule] = useState<JourneySchedule>({
    date: new Date().toISOString().split('T')[0],
    timePeriod: 'now',
  });

  const [selectedJourneyForDetails, setSelectedJourneyForDetails] = useState<JourneyOption | null>(
    null
  );

  // Sync RTL/LTR, Theme, High Contrast & Font scale to document element
  useEffect(() => {
    const htmlEl = document.documentElement;
    htmlEl.setAttribute('dir', prefs.language === 'ar' ? 'rtl' : 'ltr');
    htmlEl.setAttribute('lang', prefs.language);

    // High Contrast attribute & class
    htmlEl.setAttribute('data-high-contrast', prefs.highContrast ? 'true' : 'false');
    if (prefs.highContrast) {
      htmlEl.classList.add('high-contrast');
    } else {
      htmlEl.classList.remove('high-contrast');
    }

    // Font size
    if (prefs.fontSize === 'large') {
      htmlEl.style.fontSize = '18px';
    } else if (prefs.fontSize === 'xlarge') {
      htmlEl.style.fontSize = '20px';
    } else {
      htmlEl.style.fontSize = '16px';
    }

    // Theme computation
    const updateEffectiveTheme = () => {
      let activeTheme = prefs.theme || 'sustainable-light';
      if (activeTheme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        activeTheme = isDark ? 'eco-dark' : 'sustainable-light';
      }
      htmlEl.setAttribute('data-theme', activeTheme);
    };

    updateEffectiveTheme();

    if (prefs.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => updateEffectiveTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [prefs.language, prefs.fontSize, prefs.highContrast, prefs.theme]);

  // Handle Tab Switch with Direction Tracking
  const handleSelectTab = (newTab: TabType) => {
    if (newTab === activeTab) return;
    const oldIdx = TAB_INDEX[prevTabRef.current];
    const newIdx = TAB_INDEX[newTab];
    // In RTL, horizontal directions are reversed visually
    const dirMulti = prefs.language === 'ar' ? -1 : 1;
    setDirection((newIdx > oldIdx ? 1 : -1) * dirMulti);
    prevTabRef.current = newTab;
    setActiveTab(newTab);
  };

  // Handle preferences update
  const handleUpdatePrefs = (newPrefs: Partial<UserPreferences>) => {
    setPrefs((prev) => {
      const updated = { ...prev, ...newPrefs };
      savePreferences(updated);
      return updated;
    });
  };

  // Calculate Journey Options deterministically
  const calculatedJourneys = useMemo(() => {
    if (!originId || !destinationId || originId === destinationId) return [];
    return calculateJourneyOptions(originId, destinationId, mobilityNeed);
  }, [originId, destinationId, mobilityNeed]);

  // Handle plan updates
  const handleUpdatePlan = (data: {
    originId?: LocationId;
    destinationId?: LocationId;
    mobilityNeed?: MobilityNeedId;
    schedule?: JourneySchedule;
  }) => {
    if (data.originId !== undefined) setOriginId(data.originId);
    if (data.destinationId !== undefined) setDestinationId(data.destinationId);
    if (data.mobilityNeed !== undefined) setMobilityNeed(data.mobilityNeed);
    if (data.schedule !== undefined) setSchedule(data.schedule);
  };

  const handleCompareJourneys = () => {
    handleSelectTab('compare');
  };

  const handleSelectJourneyCard = (journey: JourneyOption) => {
    setSelectedJourneyForDetails(journey);
  };

  // Confirm choice & log to LocalStorage
  const handleConfirmJourneyChoice = (journey: JourneyOption) => {
    const originLoc = LOCATIONS.find((l) => l.id === originId);
    const destLoc = LOCATIONS.find((l) => l.id === destinationId);

    const newLog: SelectedJourneyLog = {
      id: `log-${Date.now()}`,
      selectedAt: new Date().toISOString(),
      originId,
      destinationId,
      originNameEn: originLoc?.nameEn || 'Dubai Hub',
      originNameAr: originLoc?.nameAr || 'محطة دبي',
      destinationNameEn: destLoc?.nameEn || 'Dubai Destination',
      destinationNameAr: destLoc?.nameAr || 'وجهة دبي',
      category: journey.category,
      durationMin: journey.durationMin,
      fareAED: journey.fareAED,
      emissionsKg: journey.emissionsKg,
      co2SavedKg: journey.co2SavedKg,
      carKmAvoided: journey.carKmAvoided,
      greenPoints: journey.greenPoints,
      modes: journey.modes,
    };

    const updated = addJourneyLog(newLog);
    setJourneyLogs(updated);
  };

  // Impact Screen helper: Add sample demo journey
  const handleAddSampleJourney = () => {
    const sampleLog: SelectedJourneyLog = {
      id: `log-${Date.now()}`,
      selectedAt: new Date().toISOString(),
      originId: 'dubai-marina',
      destinationId: 'business-bay',
      originNameEn: 'Dubai Marina',
      originNameAr: 'مرسى دبي',
      destinationNameEn: 'Business Bay',
      destinationNameAr: 'الخليج التجاري',
      category: 'greenest',
      durationMin: 32,
      fareAED: 7.5,
      emissionsKg: 0.62,
      co2SavedKg: 3.12,
      carKmAvoided: 19.5,
      greenPoints: 150,
      modes: ['tram', 'metro', 'walk'],
    };
    const updated = addJourneyLog(sampleLog);
    setJourneyLogs(updated);
  };

  // Impact Screen helper: Reset logs
  const handleResetLogs = () => {
    const empty = resetJourneyLogs();
    setJourneyLogs(empty);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`min-h-screen bg-[#E5EFEA] text-[#102A2E] font-sans ${
          prefs.highContrast ? 'contrast-125' : ''
        }`}
      >
        {/* Short Application Launch Experience Overlay (<= 1.8s) */}
        <LaunchSequence
          onComplete={() => {}}
          language={prefs.language}
        />

        {/* Outer Container simulating mobile viewport */}
        <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[#F5F8F5] border-x border-[#DCE6E1] shadow-2xl relative">
          {/* App Bar Header */}
          <Header prefs={prefs} onUpdatePrefs={handleUpdatePrefs} />

          {/* Main Content Area with Page Transitions */}
          <main className="flex-1 p-4 overflow-x-hidden overflow-y-auto relative">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={activeTab}
                custom={direction}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="w-full"
              >
                {activeTab === 'plan' && (
                  <PlanScreen
                    prefs={prefs}
                    onUpdatePrefs={handleUpdatePrefs}
                    journeyLogs={journeyLogs}
                    originId={originId}
                    destinationId={destinationId}
                    mobilityNeed={mobilityNeed}
                    schedule={schedule}
                    onUpdatePlan={handleUpdatePlan}
                    onCompareJourneys={handleCompareJourneys}
                  />
                )}

                {activeTab === 'compare' && (
                  <CompareScreen
                    prefs={prefs}
                    originId={originId}
                    destinationId={destinationId}
                    journeys={calculatedJourneys}
                    onSelectJourney={handleSelectJourneyCard}
                    onBackToPlan={() => handleSelectTab('plan')}
                  />
                )}

                {activeTab === 'impact' && (
                  <ImpactScreen
                    prefs={prefs}
                    journeyLogs={journeyLogs}
                    onAddSampleJourney={handleAddSampleJourney}
                    onResetLogs={handleResetLogs}
                    onPlanNew={() => handleSelectTab('plan')}
                  />
                )}

                {activeTab === 'profile' && (
                  <ProfileScreen prefs={prefs} onUpdatePrefs={handleUpdatePrefs} />
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Journey Details Modal / Bottom Sheet */}
          {selectedJourneyForDetails && (
            <JourneyDetailsModal
              prefs={prefs}
              journey={selectedJourneyForDetails}
              onClose={() => setSelectedJourneyForDetails(null)}
              onConfirmChoice={handleConfirmJourneyChoice}
            />
          )}

          {/* Fixed Mobile Bottom Navigation */}
          <BottomNav
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            prefs={prefs}
            selectedJourneyCount={journeyLogs.length}
          />
        </div>
      </div>
    </MotionConfig>
  );
}

