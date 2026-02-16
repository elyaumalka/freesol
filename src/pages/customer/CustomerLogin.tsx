import { useNavigate } from "react-router-dom";
import studioBackground from "@/assets/studio-background.png";
import freeSolLogo from "@/assets/freesol-logo.png";

export default function CustomerLogin() {
  const navigate = useNavigate();

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-no-repeat flex overflow-auto"
      style={{ backgroundImage: `url(${studioBackground})` }}
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

      {/* Login Card */}
      <div 
        className="flex items-center justify-center lg:justify-end w-full min-h-screen"
        style={{ padding: 'var(--space-xl)' }}
      >
        <div 
          className="w-full"
          style={{
            maxWidth: 'clamp(350px, 28vw, 550px)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-xl)',
            background: 'rgba(116, 37, 81, 0.4)',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255, 191, 102, 0.3)'
          }}
        >
          <h1 
            className="font-bold text-white text-center"
            style={{ 
              fontFamily: 'Discovery_Fs',
              fontSize: 'var(--text-3xl)',
              marginBottom: 'var(--space-xl)'
            }}
          >
            כניסת משתמשים
          </h1>

          {/* Buttons Container */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {/* Existing User Button */}
            <button
              onClick={() => navigate('/customer/existing-login')}
              className="w-full transition-all duration-300 hover:scale-105"
              style={{ 
                height: 'var(--btn-xl)',
                borderRadius: 'var(--radius-lg)',
                border: '2px solid #FFBF66',
                backgroundColor: 'rgba(116, 37, 81, 0.46)'
              }}
            >
              <span 
                className="text-white"
                style={{ 
                  fontFamily: 'Discovery_Fs',
                  fontSize: 'var(--text-2xl)'
                }}
              >
                משתמש קיים
              </span>
            </button>

            {/* Guest User Button */}
            <button
              onClick={() => navigate('/customer/register')}
              className="w-full transition-all duration-300 hover:scale-105"
              style={{ 
                height: 'var(--btn-xl)',
                borderRadius: 'var(--radius-lg)',
                border: '2px solid #FFBF66',
                backgroundColor: 'rgba(33, 95, 102, 0.26)'
              }}
            >
              <span 
                className="text-white"
                style={{ 
                  fontFamily: 'Discovery_Fs',
                  fontSize: 'var(--text-2xl)'
                }}
              >
                משתמש אורח
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
