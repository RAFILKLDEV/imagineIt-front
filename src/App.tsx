import Dashboard from './pages/Dashboard';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import { CampaignProvider } from './context/CampaignContext';
import Campaigns from './pages/Campaigns';
import Characters from './pages/Characters';
import Sessions from './pages/Sessions';
import Scenarios from './pages/Scenarios';
import { ToastProvider } from './components/ToastProvider';
import SessionViewer from './pages/SessionViewer';
import CampaignSettings from './pages/CampaignSettings';
import LiveRecording from './pages/LiveRecording';
import Benchmarks from './pages/Benchmarks';
import SessionBenchmark from './pages/SessionBenchmark';
import Credits from './pages/Credits';
import Login from './pages/Login';
import Account from './pages/Account';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

function ProtectedApp() {
  return <ProtectedRoute><CampaignProvider><ToastProvider><AppLayout><Routes>
              <Route path="/" element={<Campaigns/>}/>
              <Route path="/dashboard" element={<Dashboard/>}/>
              <Route path="/campaigns/:id" element={<CampaignSettings/>}/>
              <Route path="/campaigns/:id/settings" element={<CampaignSettings/>}/>
              <Route path="/live" element={<LiveRecording/>}/>
              <Route path="/benchmarks" element={<Benchmarks/>}/>
              <Route path="/benchmarks/sessions/:id" element={<SessionBenchmark/>}/>
              <Route path="/characters" element={<Characters/>}/>
              <Route path="/characters/:id" element={<Characters/>}/>
              <Route path="/sessions" element={<Sessions/>}/>
              <Route path="/scenarios" element={<Scenarios/>}/>
              <Route path="/sessions/:id" element={<SessionViewer />} />
              <Route path="/credits" element={<Credits />} />
              <Route path="/account" element={<Account />} />
  </Routes></AppLayout></ToastProvider></CampaignProvider></ProtectedRoute>;
}

export default function App(){
  return <BrowserRouter><AuthProvider><Routes><Route path="/login" element={<Login />} /><Route path="*" element={<ProtectedApp />} /></Routes></AuthProvider></BrowserRouter>;
}
