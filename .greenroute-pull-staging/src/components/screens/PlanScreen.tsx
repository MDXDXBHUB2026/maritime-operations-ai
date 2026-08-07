import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  MapPin,
  ArrowUpDown,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Check,
  RefreshCw,
  Star,
  Clock,
  History,
  Flame,
} from 'lucide-react';
import { LocationId, MobilityNeedId, UserPreferences, JourneySchedule, SelectedJourneyLog } from '../../types';
import { LOCATIONS } from '../../data/mockData';
import { translations } from '../../data/translations';
import { DisclaimerBanner } from '../DisclaimerBanner';
import { InteractiveDubaiMobilityMap } from '../common/InteractiveDubaiMobilityMap';
import { LocationBottomSheet } from '../common/LocationBottomSheet';
import { ExperienceCardsCarousel } from '../common/ExperienceCardsCarousel';
import { JourneyScheduleSelector } from '../common/JourneyScheduleSelector';
import { CompareButton } from '../common/CompareButton';
import { generateJourneyOptions } from '../../utils/routeUtils';
import { shakeOnceVariants } from '../../theme/motion';
import { analyzeFavoriteDestinations, FavoriteDestination } from '../../utils/historyAnalysis';

interface PlanScreenProps {
  prefs: UserPreferences;
  onUpdatePrefs?: (newPrefs: Partial<UserPreferences>) => void;
  journeyLogs?: SelectedJourneyLog[];
  originId: LocationId;
  destinationId: LocationId;
  mobilityNeed: MobilityNeedId;
  schedule: JourneySchedule;
  onUpdatePlan: (data: {
    originId?: LocationId;
    destinationId?: LocationId;
    mobilityNeed?: MobilityNeedId;
    schedule?: JourneySchedule;
  }) => void;
  onCompareJourneys: () => void;
}

export const PlanScreen: React.FC<PlanScreenProps> = ({
  prefs,
  onUpdatePrefs,
  journeyLogs = [],
  originId,
  destinationId,
  mobilityNeed,
  schedule,
  onUpdatePlan,
  onCompareJourneys,
}) => {
  const t = translations[prefs.language] || translations.en;
  const isRtl = prefs.language === 'ar';
  const shouldReduceMotion = useReducedMotion();

  const [bottomSheetType, setBottomSheetType] = useState<'origin' | 'destination' | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStepIndex, setAnalysisStepIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Analyze historical trip logs to get top favorite destinations
  const favoriteDestinations = useMemo(() => {
    return analyzeFavoriteDestinations(journeyLogs, 4);
  }, [journeyLogs]);

  const topFavorite = favoriteDestinations[0];

  const originItem = LOCATIONS.find((l) => l.id === originId) || LOCATIONS[0];
  const destinationItem = LOCATIONS.find((l) => l.id === destinationId) || LOCATIONS[4];

  const isSameLocation = originId === destinationId;
  const isValid = originId && destinationId && !isSameLocation;

  // Generate options for map display
  const currentOptions = generateJourneyOptions(originItem, destinationItem, mobilityNeed);
  const selectedOption = currentOptions[0];

  // Location Swap Handler with Animation & Route Reversal
  const handleSwap = () => {
    if (isSwapping) return;
    setIsSwapping(true);

    onUpdatePlan({
      originId: destinationId,
      destinationId: originId,
    });

    setStatusMessage(isRtl ? 'تم تبديل البداية والوجهة — عكس المسار' : 'Locations swapped — route reversed');

    setTimeout(() => {
      setIsSwapping(false);
    }, 700);

    setTimeout(() => {
      setStatusMessage(null);
    }, 3000);
  };

  // Location Selection Handler
  const handleSelectLocation = (id: LocationId) => {
    if (bottomSheetType === 'origin') {
      onUpdatePlan({ originId: id });
      setStatusMessage(t.startingPointSelected);
      setBottomSheetType(null);

      // Auto move focus to destination
      setTimeout(() => {
        setBottomSheetType('destination');
      }, 500);
    } else {
      onUpdatePlan({ destinationId: id });
      setStatusMessage(t.routeReadyNotice);
      setBottomSheetType(null);
    }

    setTimeout(() => {
      setStatusMessage(null);
    }, 3500);
  };

  // Quick Select Favorite Destination Handler
  const handleSelectFavoriteDestination = (fav: FavoriteDestination) => {
    const locName = isRtl ? fav.location.nameAr : fav.location.nameEn;
    onUpdatePlan({ destinationId: fav.location.id });
    const msg = t.destinationSetFromFavorites
      ? t.destinationSetFromFavorites.replace('{name}', locName)
      : (isRtl ? `تم تحديد الوجهة إلى ${locName} من المفضلة` : `Destination set to ${locName} from Recent Favorites`);
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage(null);
    }, 3500);
  };

  // Cinematic Compare Journeys Sequence
  const handleTriggerCompare = () => {
    if (!isValid || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisStepIndex(0);

    const steps = [
      t.analysingJourney,
      t.comparingConnections,
      t.estimatingCarbon,
      t.reviewingAccessibility,
      t.preparingOptions,
    ];

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < steps.length) {
        setAnalysisStepIndex(step);
      } else {
        clearInterval(interval);
        setIsAnalyzing(false);
        onCompareJourneys();
      }
    }, 450);
  };

  const analysisMessages = [
    t.analysingJourney,
    t.comparingConnections,
    t.estimatingCarbon,
    t.reviewingAccessibility,
    t.preparingOptions,
  ];

  return (
    <div className="space-y-4 pb-28">
      {/* Real Interactive Maplibre GL Map */}
      <InteractiveDubaiMobilityMap
        origin={originItem}
        destination={destinationItem}
        selectedOption={selectedOption}
        allOptions={currentOptions}
        prefs={prefs}
        onUpdatePrefs={onUpdatePrefs}
        isExpanded={isAnalyzing}
        isOriginSelecting={bottomSheetType === 'origin'}
        isDestinationSelecting={bottomSheetType === 'destination'}
        isAnalyzing={isAnalyzing}
      />

      {/* Floating Status Notification Toast */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-[#087F5B] text-white px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center justify-between shadow-md border border-[#20B486]/40"
          >
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#20B486]" />
              <span>{statusMessage}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-[10px] underline text-white/80"
            >
              OK
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cinematic Route Analysis Progress Overlay */}
      {isAnalyzing && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#102A2E] text-white p-4.5 rounded-3xl border border-[#20B486]/50 shadow-xl space-y-3"
        >
          <div className="flex items-center justify-between text-xs font-extrabold text-[#20B486]">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>GreenRoute AI Analysis Engine</span>
            </span>
            <span>{Math.round(((analysisStepIndex + 1) / analysisMessages.length) * 100)}%</span>
          </div>

          <p className="text-sm font-bold text-white">
            {analysisMessages[analysisStepIndex]}...
          </p>

          <div className="w-full bg-[#082A32] h-2 rounded-full overflow-hidden border border-[#20B486]/30">
            <motion.div
              className="h-full bg-[#20B486]"
              initial={{ width: '0%' }}
              animate={{ width: `${((analysisStepIndex + 1) / analysisMessages.length) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </motion.div>
      )}

      {/* Main Journey Composer Card */}
      <div className="bg-white border border-[#DCE6E1] rounded-3xl p-4.5 shadow-2xs space-y-3.5 relative overflow-hidden">
        {/* Origin Field Trigger */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#607276] flex items-center gap-1.5 uppercase tracking-wide">
            <span className="w-2.5 h-2.5 rounded-full bg-[#087F5B] ring-2 ring-[#087F5B]/20" />
            <span>{t.originLabel}</span>
          </label>
          <button
            type="button"
            onClick={() => setBottomSheetType('origin')}
            className="w-full h-12 bg-[#F5F8F5] border border-[#DCE6E1] hover:border-[#20B486] rounded-2xl px-3.5 flex items-center justify-between text-left transition-all shadow-2xs group"
          >
            <div className="flex items-center gap-2.5 truncate">
              <MapPin className="w-4 h-4 text-[#087F5B] shrink-0" />
              <div>
                <div className="font-extrabold text-sm text-[#102A2E]">
                  {isRtl ? originItem.nameAr : originItem.nameEn}
                </div>
                <div className="text-[10px] text-[#607276] font-semibold truncate">
                  {originItem.districtEn} • {originItem.metroStation}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#607276] group-hover:text-[#102A2E] shrink-0" />
          </button>
        </div>

        {/* Route Connecting Swap Control */}
        <div className="relative h-7 flex items-center justify-center my-0.5">
          <div className="absolute top-0 bottom-0 w-0.5 bg-[#DCE6E1]" />
          <motion.button
            type="button"
            onClick={handleSwap}
            animate={{ rotate: isSwapping ? 180 : 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="absolute z-10 w-9 h-9 rounded-full bg-white border border-[#DCE6E1] text-[#087F5B] hover:bg-[#EAF3EE] transition-all shadow-md flex items-center justify-center"
            aria-label={t.swapLocations}
            title={t.swapLocations}
          >
            <ArrowUpDown className="w-4 h-4 text-[#087F5B]" />
          </motion.button>
        </div>

        {/* Destination Field Trigger */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#607276] flex items-center gap-1.5 uppercase tracking-wide">
            <span className="w-2.5 h-2.5 rounded-full bg-[#082A32] ring-2 ring-[#082A32]/20" />
            <span>{t.destinationLabel}</span>
          </label>
          <button
            type="button"
            onClick={() => setBottomSheetType('destination')}
            className={`w-full h-12 bg-[#F5F8F5] border ${
              isSameLocation ? 'border-[#C43D4B] ring-1 ring-[#C43D4B]/30' : 'border-[#DCE6E1] hover:border-[#20B486]'
            } rounded-2xl px-3.5 flex items-center justify-between text-left transition-all shadow-2xs group`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <MapPin className="w-4 h-4 text-[#082A32] shrink-0" />
              <div>
                <div className="font-extrabold text-sm text-[#102A2E]">
                  {isRtl ? destinationItem.nameAr : destinationItem.nameEn}
                </div>
                <div className="text-[10px] text-[#607276] font-semibold truncate">
                  {destinationItem.districtEn} • {destinationItem.metroStation}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#607276] group-hover:text-[#102A2E] shrink-0" />
          </button>
        </div>

        {/* Validation Error */}
        {isSameLocation && (
          <motion.div
            variants={shakeOnceVariants}
            initial="idle"
            animate="shake"
            className="flex items-start gap-2 text-xs text-[#C43D4B] bg-rose-50 border border-rose-200 p-3 rounded-2xl"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 text-[#C43D4B] shrink-0 mt-0.5" />
            <p className="font-semibold">{t.sameOriginDestinationError}</p>
          </motion.div>
        )}
      </div>

      {/* Recent Favorites & Frequent Destinations Section */}
      {favoriteDestinations.length > 0 && (
        <div className="bg-white border border-[#DCE6E1] rounded-3xl p-4 shadow-2xs space-y-3 relative overflow-hidden">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-[#087F5B] flex items-center justify-center shrink-0 shadow-2xs">
                <Star className="w-4 h-4 fill-[#087F5B]" />
              </div>
              <div>
                <h3 className="font-extrabold text-xs text-[#102A2E] leading-tight flex items-center gap-1.5">
                  <span>{t.recentFavoritesTitle}</span>
                  <span className="bg-[#EAF3EE] text-[#087F5B] text-[9px] px-1.5 py-0.2 rounded-full font-extrabold">
                    {favoriteDestinations.length} {isRtl ? 'وجهات' : 'frequent'}
                  </span>
                </h3>
                <p className="text-[10px] text-[#607276]">
                  {t.recentFavoritesSubtitle}
                </p>
              </div>
            </div>

            {topFavorite && (
              <span className="bg-[#102A2E] text-[#20B486] text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                <Sparkles className="w-3 h-3 text-[#20B486]" />
                <span>{t.mostVisitedBadge}</span>
              </span>
            )}
          </div>

          {/* Top Most Common Destination Banner */}
          {topFavorite && (
            <div className="bg-[#F5F8F5] border border-[#20B486]/40 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-8 h-8 rounded-xl bg-[#087F5B] text-white flex items-center justify-center shrink-0 font-black text-xs shadow-2xs">
                  <Flame className="w-4 h-4 text-emerald-200" />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs text-[#102A2E] truncate">
                      {isRtl ? topFavorite.location.nameAr : topFavorite.location.nameEn}
                    </span>
                    <span className="text-[9px] bg-[#087F5B]/15 text-[#087F5B] font-bold px-1.5 py-0.2 rounded-full shrink-0">
                      {topFavorite.count} {isRtl ? 'رحلة' : 'trips'}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#607276] truncate">
                    {topFavorite.location.districtEn} • {topFavorite.location.metroStation}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectFavoriteDestination(topFavorite)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 transition-all shadow-2xs ${
                  destinationId === topFavorite.location.id
                    ? 'bg-[#087F5B] text-white'
                    : 'bg-white border border-[#20B486] text-[#087F5B] hover:bg-[#EAF3EE]'
                }`}
              >
                {destinationId === topFavorite.location.id
                  ? (isRtl ? 'الوجهة الحالية' : 'Active Destination')
                  : (isRtl ? 'تحديد كوجهة' : 'Quick Select')}
              </button>
            </div>
          )}

          {/* Favorite Destinations Horizontal Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {favoriteDestinations.map((fav) => {
              const locName = isRtl ? fav.location.nameAr : fav.location.nameEn;
              const isSelected = destinationId === fav.location.id;

              return (
                <button
                  key={fav.location.id}
                  type="button"
                  onClick={() => handleSelectFavoriteDestination(fav)}
                  className={`px-3 py-2 rounded-2xl text-xs font-bold shrink-0 flex items-center gap-2 border transition-all shadow-2xs ${
                    isSelected
                      ? 'bg-[#087F5B] text-white border-[#087F5B] ring-2 ring-[#087F5B]/20'
                      : 'bg-[#F5F8F5] text-[#102A2E] border-[#DCE6E1] hover:border-[#20B486] hover:bg-[#EAF3EE]'
                  }`}
                >
                  <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-[#087F5B]'}`} />
                  <div className="text-left rtl:text-right">
                    <div className="leading-tight font-extrabold">{locName}</div>
                    <div className={`text-[9px] ${isSelected ? 'text-white/80' : 'text-[#607276]'}`}>
                      {fav.count} {isRtl ? 'رحلة' : 'trips'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Journey Date & Time Schedule Selector */}
      <JourneyScheduleSelector
        schedule={schedule}
        onUpdateSchedule={(newSched) => onUpdatePlan({ schedule: newSched })}
        prefs={prefs}
      />

      {/* Mobility & Inclusive Preference Cards Carousel */}
      <ExperienceCardsCarousel
        selectedNeedId={mobilityNeed}
        onSelectNeed={(id) => onUpdatePlan({ mobilityNeed: id })}
        prefs={prefs}
      />

      {/* Compare Journeys CTA */}
      <CompareButton
        onClick={handleTriggerCompare}
        disabled={!isValid || isAnalyzing}
        prefs={prefs}
      />

      {/* Proof of Concept Disclaimer Banner */}
      <DisclaimerBanner prefs={prefs} variant="full" />

      {/* Location Bottom Sheet Modal */}
      <LocationBottomSheet
        isOpen={bottomSheetType !== null}
        onClose={() => setBottomSheetType(null)}
        type={bottomSheetType || 'origin'}
        locations={LOCATIONS}
        selectedLocationId={bottomSheetType === 'origin' ? originId : destinationId}
        onSelectLocation={handleSelectLocation}
        prefs={prefs}
        journeyLogs={journeyLogs}
      />
    </div>
  );
};

