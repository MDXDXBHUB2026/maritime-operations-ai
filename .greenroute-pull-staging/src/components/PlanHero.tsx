import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Sparkles, Train, Bus, Bike } from 'lucide-react';
import { UserPreferences } from '../types';
import { translations } from '../data/translations';

interface PlanHeroProps {
  prefs: UserPreferences;
}

export const PlanHero: React.FC<PlanHeroProps> = ({ prefs }) => {
  const t = translations[prefs.language] || translations.en;
  const shouldReduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);

  const [isIntersecting, setIsIntersecting] = useState(true);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);

  // Monitor visibility & intersection to pause background motion when off-screen or tab inactive
  useEffect(() => {
    const handleVisibility = () => {
      setIsDocumentVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      { threshold: 0.1 }
    );

    if (heroRef.current) {
      observer.observe(heroRef.current);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      observer.disconnect();
    };
  }, []);

  const shouldAnimate = !shouldReduceMotion && isIntersecting && isDocumentVisible;

  return (
    <div
      ref={heroRef}
      className="bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950/80 border border-slate-800 p-5 rounded-2xl shadow-xl relative overflow-hidden"
    >
      {/* Soft sustainability light effect */}
      <div className="absolute -top-12 -right-12 w-44 h-44 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Abstract Dubai Urban Grid Overlay */}
      <div className="absolute inset-0 opacity-15 pointer-events-none overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 400 180" fill="none">
          <pattern id="urbanGrid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#2DD4BF" strokeWidth="0.5" strokeDasharray="2 2" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#urbanGrid)" />
        </svg>
      </div>

      {/* Thin Animated Mobility Route & Moving Transport Indicators */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 400 180" fill="none">
          <path
            d="M -10,90 C 80,30 180,140 280,50 C 330,10 380,80 420,90"
            stroke="url(#heroRouteGrad)"
            strokeWidth="2"
            strokeDasharray="4 4"
            opacity="0.6"
          />

          <defs>
            <linearGradient id="heroRouteGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0D9488" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
          </defs>
        </svg>

        {/* Small transport-mode indicators moving slowly along route */}
        {shouldAnimate && (
          <>
            <motion.div
              className="absolute text-teal-300 w-5 h-5 rounded-full bg-slate-900/90 border border-teal-400/80 flex items-center justify-center shadow-md shadow-teal-500/30"
              animate={{
                offsetDistance: ['0%', '100%'],
              }}
              transition={{
                duration: 16,
                repeat: Infinity,
                ease: 'linear',
              }}
              style={{
                offsetPath: 'path("M -10,90 C 80,30 180,140 280,50 C 330,10 380,80 420,90")',
              }}
            >
              <Train className="w-3 h-3" />
            </motion.div>

            <motion.div
              className="absolute text-emerald-300 w-5 h-5 rounded-full bg-slate-900/90 border border-emerald-400/80 flex items-center justify-center shadow-md shadow-emerald-500/30"
              animate={{
                offsetDistance: ['0%', '100%'],
              }}
              transition={{
                duration: 22,
                repeat: Infinity,
                delay: 6,
                ease: 'linear',
              }}
              style={{
                offsetPath: 'path("M -10,90 C 80,30 180,140 280,50 C 330,10 380,80 420,90")',
              }}
            >
              <Bus className="w-3 h-3" />
            </motion.div>
          </>
        )}
      </div>

      {/* Hero Content */}
      <div className="relative z-10 flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0 mt-0.5 text-teal-400 shadow-md shadow-teal-950">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-white leading-snug tracking-tight">
            {prefs.language === 'ar'
              ? 'اختر وسيلة أذكى للتنقل'
              : 'Choose a smarter way to move'}
          </h2>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {prefs.language === 'ar'
              ? 'قَارِن بين الوقت والتكلفة وإمكانية الوصول والأثر الكربوني التقديري.'
              : 'Compare time, cost, accessibility and estimated carbon impact.'}
          </p>
        </div>
      </div>
    </div>
  );
};

