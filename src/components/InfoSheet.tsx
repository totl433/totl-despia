import { useEffect } from'react';
import { createPortal } from'react-dom';
import { Link } from'react-router-dom';
import { VOLLEY_AVATAR_PATH } from '../lib/volley';

export type InfoSheetProps = {
 isOpen: boolean;
 onClose: () => void;
 title: string;
 description: string;
 image?: string; // Optional image path to display in the tooltip
};

export default function InfoSheet({ isOpen, onClose, title, description, image }: InfoSheetProps) {
 // Close on escape key
 useEffect(() => {
 if (!isOpen) return;
 
 const handleEscape = (e: KeyboardEvent) => {
 if (e.key ==='Escape') {
 onClose();
 }
 };
 
 document.addEventListener('keydown', handleEscape);
 return () => document.removeEventListener('keydown', handleEscape);
 }, [isOpen, onClose]);

 // Prevent body scroll when open
 useEffect(() => {
 if (isOpen) {
 document.body.style.overflow ='hidden';
 } else {
 document.body.style.overflow ='';
 }
 return () => {
 document.body.style.overflow ='';
 };
 }, [isOpen]);

 if (!isOpen) return null;

 const content = (
 <>
 {/* Backdrop */}
 <div
 className="fixed inset-0 bg-black/50"
 onClick={onClose}
 aria-hidden="true"
 style={{
 animation:'fadeIn 200ms ease-out',
 zIndex: 999999,
 }}
 />
 
 {/* Sheet */}
 <div
 className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl"
 role="dialog"
 aria-modal="true"
 aria-labelledby="info-sheet-title"
 aria-describedby="info-sheet-description"
 style={{
 animation:'slideUp 300ms ease-out',
 zIndex: 1000000,
 }}
 >
 {/* Top handle */}
 <div className="flex justify-center pt-3 pb-2">
 <div className="w-12 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
 </div>

 {/* Header */}
 <div className="flex items-center justify-between px-6 pb-4">
 <h2 id="info-sheet-title" className="text-lg font-medium text-slate-900 dark:text-slate-100 uppercase tracking-wide" style={{ fontFamily:'"Gramatika", sans-serif', fontWeight: 700 }}>
 {title}
 </h2>
 <button
 onClick={onClose}
 className="w-8 h-8 flex items-center justify-center rounded-full"
 aria-label="Close"
 >
 <svg
 className="w-5 h-5 text-slate-600 dark:text-slate-400"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M6 18L18 6M6 6l12 12"
 />
 </svg>
 </button>
 </div>

 {/* Content */}
 <div className="px-6 pb-8 max-h-[70vh] overflow-y-auto relative">
 <div id="info-sheet-description" className="text-slate-600 dark:text-slate-300 leading-relaxed">
 {(() => {
 // Split on newlines and filter empty lines
 const paragraphs = description
 .split(/\n+/)
 .map(line => line.trim())
 .filter(line => line.length > 0);
 
 return paragraphs.map((paragraph, index) => {
 // Check if this paragraph is a category header (all caps, short, no punctuation)
 const isCategoryHeader = paragraph.length < 20 && paragraph === paragraph.toUpperCase() && /^[A-Z\s-]+$/.test(paragraph);
 
 if (isCategoryHeader) {
 return (
          <h3 key={index} className={`font-bold text-slate-900 dark:text-slate-100 text-base ${index === 0 ?'' :'mt-6'}`}>
 {paragraph}
 </h3>);
 }
 
 // Render paragraph with links and chip examples
 const parts: React.ReactNode[] = [];
 let remaining = paragraph;

 // Replace Volley example avatar tokens:
 // - (VOLLEY_SUBMITTED) -> Volley avatar with green ring
 // - (VOLLEY_UNSUBMITTED) -> Volley avatar with faint styling (no ring)
 // - (VOLLEY_WINNER) -> Volley avatar with shiny overlay
 const volleyTokenPattern = /\(VOLLEY_(SUBMITTED|UNSUBMITTED|WINNER)\)/g;
 if (volleyTokenPattern.test(remaining)) {
   const nodes: React.ReactNode[] = [];
   let lastIndex = 0;
   volleyTokenPattern.lastIndex = 0;
   let match: RegExpExecArray | null;
   while ((match = volleyTokenPattern.exec(remaining)) !== null) {
     const before = remaining.slice(lastIndex, match.index);
     if (before) nodes.push(before);

     const kind = match[1];
     const baseClass =
       'inline-flex w-6 h-6 rounded-full overflow-hidden align-middle mx-1 relative bg-sky-200';
     const imgClassBase = 'w-full h-full object-contain p-0.5';

     if (kind === 'SUBMITTED') {
       nodes.push(
         <span
           key={`volley-${index}-${match.index}`}
           className={`${baseClass} ring-[3px] ring-emerald-500 dark:ring-emerald-400`}
           title="Submitted"
         >
           <img src={VOLLEY_AVATAR_PATH} alt="" className={imgClassBase} />
         </span>
       );
     } else if (kind === 'WINNER') {
       nodes.push(
         <span
           key={`volley-${index}-${match.index}`}
           className={`${baseClass} ring-[3px] ring-yellow-400 dark:ring-yellow-300 shadow-md shadow-yellow-400/25 before:absolute before:inset-0 before:z-10 before:pointer-events-none before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:z-10 after:pointer-events-none after:bg-gradient-to-br after:from-yellow-400/25 after:via-pink-500/15 after:to-purple-600/20`}
           title="Last GW winner"
         >
           <img src={VOLLEY_AVATAR_PATH} alt="" className={imgClassBase} />
         </span>
       );
     } else {
       nodes.push(
         <span
           key={`volley-${index}-${match.index}`}
           className={`${baseClass}`}
           title="Not submitted"
         >
           <img
             src={VOLLEY_AVATAR_PATH}
             alt=""
             className={`${imgClassBase} brightness-75`}
           />
         </span>
       );
     }

     lastIndex = match.index + match[0].length;
   }
   const after = remaining.slice(lastIndex);
   if (after) nodes.push(after);

   // Rebuild remaining as a marker-free string and push the nodes directly.
   // (We keep the existing link/chip parsing pipeline intact by storing nodes in parts.)
   parts.push(...nodes);
   remaining = '';
 }
 
 // Check for chip examples like"(TB)" and replace with actual chip components
 const chipPattern = /\(TB\)/g;
 if (chipPattern.test(remaining)) {
 const segments = remaining.split(chipPattern);
 segments.forEach((segment, segIndex) => {
 if (segment) parts.push(segment);
 if (segIndex < segments.length - 1) {
 // Add chip example - check text after (TB) to determine chip type
 const afterChip = remaining.substring(remaining.indexOf('(TB)') + 4);
 const isShiny = afterChip.toLowerCase().includes('gameweek winner');
 const isGreen = afterChip.toLowerCase().includes('submitted') && !afterChip.toLowerCase().includes('not');
 
 let chipClassName ='chip-container rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 w-6 h-6 inline-flex mx-1';
 if (isShiny) {
 chipClassName +=' bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-xl shadow-yellow-400/40 font-semibold';
 } else if (isGreen) {
 chipClassName +=' chip-green';
 } else {
 chipClassName +=' chip-grey';
 }
 
 parts.push(
 <span key={`chip-${segIndex}`} className={chipClassName} style={{ verticalAlign:'middle' }}>
 TB
 </span>);
 remaining = remaining.substring(remaining.indexOf('(TB)') + 4);
 }
 });
 } else {
 parts.push(remaining);
 }
 
 // Check for"Start a Mini League →"
 const finalParts: React.ReactNode[] = [];
 parts.forEach((part) => {
 if (typeof part ==='string' && part.includes('Start a Mini League →')) {
 const [before, after] = part.split('Start a Mini League →');
 if (before) finalParts.push(before);
 finalParts.push(
 <Link
 key="start-league"
 to="/tables"
 onClick={onClose}
 className="text-[#1C8376] font-semibold inline-flex items-center gap-1"
 >
 Start a Mini League →
 </Link>);
 if (after) finalParts.push(after);
 } else if (typeof part ==='string' && part.includes('How To Play →')) {
 const [before, after] = part.split('How To Play →');
 if (before) finalParts.push(before);
 finalParts.push(
 <Link
 key="how-to-play"
 to="/how-to-play"
 onClick={onClose}
 className="text-[#1C8376] font-semibold inline-flex items-center gap-1"
 >
 How To Play →
 </Link>);
 if (after) finalParts.push(after);
 } else {
 finalParts.push(part);
 }
 });
 
 // If we found links or chips, render with components, otherwise render as plain text
 if (finalParts.length > 1 || (finalParts.length === 1 && typeof finalParts[0] !=='string')) {
 return (
 <p key={index} className={index === 0 ?'' :'mt-4'}>
 {finalParts}
 </p>);
 }
 
 return (
 <p key={index} className={index === 0 ?'' :'mt-4'}>
 {paragraph}
 </p>);
 });
 })()}
 </div>
 {image && (
 <div className="absolute bottom-4 right-6">
 <img 
 src={image} 
 alt="" 
 className="w-16 h-16 object-contain"
 style={{ imageRendering:'pixelated' }}
 />
 </div>)}
 </div>

 {/* Bottom handle */}
 <div className="flex justify-center pb-3">
 <div className="w-12 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
 </div>
 </div>
 </>);

 // Render to document.body using portal to ensure it's above everything
 if (typeof document !=='undefined' && document.body) {
 return createPortal(content, document.body);
 }
 
 return content;
}
