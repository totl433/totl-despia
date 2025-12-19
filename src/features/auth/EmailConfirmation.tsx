/**
 * Email confirmation screen shown after signup
 */

interface EmailConfirmationProps {
  email: string;
  onBackToSignUp: () => void;
}

export default function EmailConfirmation({ email, onBackToSignUp }: EmailConfirmationProps) {
  return (
    <div className="min-h-screen flex flex-col bg-white px-6 pt-16">
      <h1 className="text-2xl font-bold text-slate-900 mb-4">Check Your Email</h1>
      
      <p className="text-slate-600 mb-2">
        We've sent you a confirmation link at <strong>{email}</strong>
      </p>
      
      <p className="text-sm text-slate-500 mb-6">
        Click the link in your email to activate your account and start playing TOTL!
      </p>
      
      <button
        type="button"
        onClick={onBackToSignUp}
        className="text-[#1C8376] hover:underline text-sm"
      >
        Back to signup
      </button>
    </div>
  );
}
