import { NavLink, Routes, Route } from 'react-router-dom'
import TopNav from './components/TopNav.jsx'
import SuggestPage from './pages/SuggestPage.jsx'
import TranslatePage from './pages/TranslatePage.jsx'
import BundlePage from './pages/BundlePage.jsx'

export default function App() {
  const navClass = ({ isActive }) => (
    'px-3 py-2 rounded-xl text-sm ' + (isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-100')
  )

  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
          <NavLink to="/suggest" className={navClass}>Suggest &amp; Expand</NavLink>
          <NavLink to="/translate" className={navClass}>Translate</NavLink>
          <NavLink to="/bundle" className={navClass}>Bundle Lab</NavLink>
        </div>
        <Routes>
          <Route path="/suggest" element={<SuggestPage />} />
          <Route path="/translate" element={<TranslatePage />} />
          <Route path="/bundle" element={<BundlePage />} />
        </Routes>
      </div>
    </div>
  )
}
