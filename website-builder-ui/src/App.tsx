import { Navigate, Route, Routes } from 'react-router-dom'
import SitesList from './pages/SitesList'
import EditorPage from './pages/EditorPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SitesList />} />
      <Route path="/:websiteId" element={<EditorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
