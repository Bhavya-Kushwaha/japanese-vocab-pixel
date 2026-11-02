import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Learn from './pages/Learn.jsx';
import Library from './pages/Library.jsx';
import Review from './pages/Review.jsx';

function Layout({ children }) {
  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
      <h1 className="text-xl md:text-3xl mb-4 nes-text is-primary text-center uppercase">Fuku</h1>
      <div className="flex flex-wrap gap-2 justify-center mb-6">
        <Link to="/" className="nes-btn is-small">HOME</Link>
        <Link to="/learn" className="nes-btn is-small is-primary">LEARN</Link>
        <Link to="/review" className="nes-btn is-small is-warning">⚔️ REVIEW</Link>
        <Link to="/library" className="nes-btn is-small" style={{ background: '#a855f7', color: '#fff' }}>📖 LIBRARY</Link>
        <Link to="/quests" className="nes-btn is-small is-success">QUESTS</Link>
        <Link to="/achievements" className="nes-btn is-small is-success">🏆 BADGES</Link>
        <Link to="/shop" className="nes-btn is-small is-warning">SHOP</Link>
        <Link to="/profile" className="nes-btn is-small">PROFILE</Link>
      </div>
      <div className="w-full">
        {children}
      </div>
    </div>
  );
}

function Home() {
  return <div className="nes-container is-dark with-title"><p className="title">Home</p><p>Welcome to Fuku Dashboard.</p></div>;
}


function Quests() {
  return <div className="nes-container is-dark with-title"><p className="title">Quests</p><p>Daily Quests.</p></div>;
}

function Achievements() {
  return <div className="nes-container is-dark with-title"><p className="title">Achievements</p><p>Trophy Room.</p></div>;
}

function Shop() {
  return <div className="nes-container is-dark with-title"><p className="title">Shop</p><p>Item Shop.</p></div>;
}

function Profile() {
  return <div className="nes-container is-dark with-title"><p className="title">Profile</p><p>Settings and Cloud Sync.</p></div>;
}

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/review" element={<Review />} />
          <Route path="/library" element={<Library />} />
          <Route path="/quests" element={<Quests />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Layout>
    </Router>
  );
}
