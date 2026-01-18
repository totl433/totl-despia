/**
 * Email confirmation screen shown after signup
 */
import { useState } from 'react';
import { resendConfirmationEmail } from './useSupabaseAuth';

interface EmailConfirmationProps {
  email: string;
  onBackToSignUp: () => void;
  onGoToSignIn: () => void;
}

export default function EmailConfirmation({
  email,
  onBackToSignUp,
  onGoToSignIn,
}: EmailConfirmationProps) {
 const [isResending, setIsResending] = useState(false);
 const [resendSuccess, setResendSuccess] = useState(false);
 const [resendError, setResendError] = useState<string | null>(null);

 const handleResend = async () => {
   setIsResending(true);
   setResendError(null);
   setResendSuccess(false);
   
   try {
     await resendConfirmationEmail(email);
     setResendSuccess(true);
   } catch (err: any) {
     setResendError(err?.message || 'Failed to resend email. Please try again.');
   } finally {
     setIsResending(false);
   }
 };

 return (
 <div className="min-h-screen bg-white">
 <div className="min-h-screen flex flex-col bg-white px-6 pt-16 w-full max-w-[1024px] mx-auto">
 <h1 className="text-2xl font-semibold text-slate-900 mb-4">Check Your Email</h1>
 
 <p className="text-slate-600 mb-2">
 We've sent you a confirmation link at <strong>{email}</strong>
 </p>
 
 <p className="text-sm text-slate-500 mb-6">
 Click the link in your email to activate your account and start playing TOTL!
 </p>

 {resendSuccess && (
   <p className="text-sm text-emerald-600 mb-4">
     Confirmation email sent! Please check your inbox.
   </p>
 )}

 {resendError && (
   <p className="text-sm text-red-600 mb-4">
     {resendError}
   </p>
 )}

 <button
   type="button"
   onClick={handleResend}
   disabled={isResending}
   className="w-full py-3 bg-[#1C8376] text-white font-semibold rounded-full mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
 >
   {isResending ? 'Sending...' : 'Resend Confirmation Email'}
 </button>
 
<div className="flex flex-col gap-3 items-center sm:items-start">
  <button
    type="button"
    onClick={onBackToSignUp}
    className="text-[#1C8376] text-sm"
  >
    Back to signup
  </button>
  <button
    type="button"
    onClick={onGoToSignIn}
    className="text-[#1C8376] text-sm"
  >
    Sign in
  </button>
</div>
 </div>
 </div>);
}
