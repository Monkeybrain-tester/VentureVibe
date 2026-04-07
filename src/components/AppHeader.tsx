import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const isDummyMode = import.meta.env.VITE_APP_MODE === 'dummy';

function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const profilePath = isDummyMode ? '/profile/test-user-1' : '/profile';

  async function handleLogout() {
    try {
      await signOut();
      navigate('/auth');
    } catch (err) {
      console.error(err);
      alert('failed to sign out');
    }
  }

  return (
    <header
      style={{
        width: '100%',
        borderBottom: '1px solid #444',
        marginBottom: 24,
        background: '#1f1f1f',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>VentureVibe</div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <nav style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link to={profilePath}>
              <button>profile</button>
            </Link>

            <Link to="/trips/new">
              <button>make trip</button>
            </Link>

            <Link to="/friends">
              <button>friends</button>
            </Link>

            <Link to="/map">
              <button>map</button>
            </Link>
          </nav>

          {user && <button onClick={handleLogout}>logout</button>}
        </div>
      </div>
    </header>
  );
}

export default AppHeader;