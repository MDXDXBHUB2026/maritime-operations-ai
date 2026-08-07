import React from 'react';
import { Leaf, Globe, Type } from 'lucide-react';
import { UserPreferences, FontSizeOption } from '../types';
import { translations } from '../data/translations';

interface HeaderProps {
  prefs: UserPreferences;
  onUpdatePrefs: (newPrefs: Partial<UserPreferences>) => void;
}

export const Header: React.FC<HeaderProps> = ({ prefs, onUpdatePrefs }) => {
  const t = translations[prefs.language] || translations.en;

  const toggleLanguage = () => {
    onUpdatePrefs({ language: prefs.language === 'en' ? 'ar' : 'en' });
  };

  const cycleFontSize = () => {
    const options: FontSizeOption[] = ['normal', 'large', 'xlarge'];
    const nextIdx = (options.indexOf(prefs.fontSize) + 1) % options.length;
    onUpdatePrefs({ fontSize: options[nextIdx] });
  };

  return (
    <header className="bg-[#F5F8F5]/90 backdrop-blur-md text-[#102A2E] border-b border-[#DCE6E1] sticky top-0 z-30 shadow-2xs">
      <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between">
        {/* Brand logo & Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#087F5B] to-[#20B486] flex items-center justify-center shadow-xs text-white shrink-0">
            <Leaf className="w-4.5 h-4.5 fill-white stroke-white" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-base tracking-tight text-[#087F5B] leading-none">
                {t.appTitle}
              </h1>
              <span className="bg-[#EAF3EE] text-[#087F5B] border border-[#DCE6E1] text-[10px] font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                Demo
              </span>
            </div>
            <p className="text-[11px] text-[#607276] font-medium line-clamp-1 mt-0.5">
              {t.appSubTitle}
            </p>
          </div>
        </div>

        {/* Header Controls (Lang + Font) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={toggleLanguage}
            className="h-8 px-2.5 min-w-[40px] rounded-xl bg-white border border-[#DCE6E1] text-[#102A2E] text-xs font-bold hover:bg-[#EAF3EE] focus:ring-2 focus:ring-[#087F5B] transition-colors flex items-center gap-1"
            aria-label={`Switch language to ${prefs.language === 'en' ? 'Arabic' : 'English'}`}
            title="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5 text-[#087F5B]" aria-hidden="true" />
            <span className="uppercase">{prefs.language === 'en' ? 'العربية' : 'EN'}</span>
          </button>

          <button
            onClick={cycleFontSize}
            className="w-8 h-8 min-w-[32px] rounded-xl bg-white border border-[#DCE6E1] text-[#102A2E] hover:bg-[#EAF3EE] focus:ring-2 focus:ring-[#087F5B] transition-colors flex items-center justify-center relative"
            aria-label={`Change text size (Current: ${prefs.fontSize})`}
            title={`Font size: ${prefs.fontSize}`}
          >
            <Type className="w-3.5 h-3.5 text-[#607276]" aria-hidden="true" />
            <span className="absolute -top-1 -right-1 text-[9px] font-extrabold bg-[#087F5B] text-white w-4 h-4 rounded-full flex items-center justify-center">
              {prefs.fontSize === 'normal' ? '1x' : prefs.fontSize === 'large' ? '2x' : '3x'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

