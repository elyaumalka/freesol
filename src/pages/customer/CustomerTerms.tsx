import { useState } from "react";
import { useNavigate } from "react-router-dom";
import studioBackground from "@/assets/studio-background.png";
import freeSolLogo from "@/assets/freesol-logo.png";

export default function CustomerTerms() {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    if (!accepted) {
      setAccepted(true);
      // Navigate to packages after short delay
      setTimeout(() => {
        navigate('/customer/packages');
      }, 500);
    }
  };

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-no-repeat flex items-center justify-center overflow-auto"
      style={{ backgroundImage: `url(${studioBackground})`, padding: 'var(--space-lg)' }}
    >
      {/* Logo */}
      <div className="absolute top-0" style={{ right: 'var(--space-lg)' }}>
        <div 
          className="bg-white p-[var(--space-md)]"
          style={{ borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}
        >
          <img 
            src={freeSolLogo} 
            alt="FreeSol Logo" 
            style={{ height: 'clamp(56px, 5vw, 100px)' }}
          />
        </div>
      </div>

      {/* Terms Card */}
      <div 
        className="w-full"
        style={{
          maxWidth: 'clamp(700px, 55vw, 1100px)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-2xl)',
          marginTop: 'clamp(48px, 5vh, 80px)',
          background: 'linear-gradient(135deg, rgba(116, 37, 81, 0.7) 0%, rgba(37, 54, 116, 0.7) 100%)',
          backdropFilter: 'blur(15px)',
          border: '1px solid rgba(255, 191, 102, 0.2)'
        }}
      >
        <h1 
          className="font-bold text-white text-center"
          style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-xl)' }}
        >
          לצורך ההרשמה יש לאשר תנאי שימוש במערכת
        </h1>

        <div className="text-white text-right leading-relaxed" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <h2 
            className="font-bold text-center text-[#7FD4FF]"
            style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-lg)' }}
          >
            תנאי שימוש – FREESOL
          </h2>
          
          <p className="text-center" style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)' }}>
            השימוש בתוכנת FREESOL ובשירותי האולפן ההיברידיים כפוף לתנאים הבאים:
          </p>

          <div 
            className="text-center leading-relaxed overflow-y-auto"
            style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-sm)', maxHeight: '40vh', padding: '0 var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}
          >
            <p>– אני מאשר/ת כי קראתי והבנתי את תנאי השימוש ומדיניות הפרטיות.</p>
            <p>– אני מסכים/ה שכל שימוש במערכת, הזמנת אולפן, העלאת קבצים ושימוש בשירותים יתבצעו באחריותי המלאה.</p>
            <p>– אני מאשר/ת כי ייתכנו עדכונים בתנאי השימוש ובמחירים, והמשך שימושי בשירות מהווה הסכמה לעדכונים.</p>
            <p>– אני מצהיר/ה שכל החומרים שאעלה לתוכנה הינם בבעלותי ואינם מפרים זכויות יוצרים.</p>
            <p>– אני מודע/ת לכך ש-FREESOL רשאית להגביל או לחסום שימוש במקרה של הפרת תנאים או פגיעה במערכת.</p>
            <p>– אני מודע/ת לכך שביטול הזמנה יתבצע רק דרך המערכת ובהתאם למדיניות הביטולים בתוקף במועד ההזמנה אי-הגעה או ביטול מאוחר עשויים לחייב את המשתמש בתשלום מלא.</p>
          </div>
        </div>

        {/* Checkbox */}
        <div className="flex items-center justify-center" style={{ gap: 'var(--space-md)', marginTop: 'var(--space-xl)' }}>
          <span 
            className="font-bold text-white"
            style={{ fontFamily: 'Discovery_Fs', fontSize: 'var(--text-base)' }}
          >
            קראתי והבנתי את תנאי השימוש
          </span>
          <button
            onClick={handleAccept}
            className={`flex items-center justify-center transition-all ${
              accepted ? 'bg-[#FFBF66] border-[#FFBF66]' : 'bg-transparent hover:border-[#FFBF66]'
            }`}
            style={{ 
              width: 'var(--icon-md)', 
              height: 'var(--icon-md)', 
              borderRadius: 'var(--radius-sm)',
              border: '2px solid white'
            }}
          >
            {accepted && (
              <svg style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} className="text-[#742551]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}