import { useEffect } from'react';
import { createPortal } from'react-dom';
import { Link } from'react-router-dom';

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
 className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl"
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
 <div className="w-12 h-1 bg-slate-300 rounded-full" />
 </div>

 {/* Header */}
 <div className="flex items-center justify-between px-6 pb-4">
 <h2 id="info-sheet-title" className="text-lg font-medium text-slate-900 uppercase tracking-wide" style={{ fontFamily:'"Gramatika", sans-serif', fontWeight: 700 }}>
 {title}
 </h2>
 <button
 onClick={onClose}
 className="w-8 h-8 flex items-center justify-center rounded-full"
 aria-label="Close"
 >
 <svg
 className="w-5 h-5 text-slate-600"
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
 <div id="info-sheet-description" className="text-slate-600 leading-relaxed">
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
          <h3 key={index} className={`font-bold text-slate-900 text-base ${index === 0 ?'' :'mt-6'}`}>
 {paragraph}
 </h3>);
 }
 
 // Render paragraph with links and chip examples
 const parts: React.ReactNode[] = [];
 let remaining = paragraph;
 
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
 <div className="w-12 h-1 bg-slate-300 rounded-full" />
 </div>
 </div>
 </>);

 // Render to document.body using portal to ensure it's above everything
 if (typeof document !=='undefined' && document.body) {
 return createPortal(content, document.body);
 }
 
 return content;
}
