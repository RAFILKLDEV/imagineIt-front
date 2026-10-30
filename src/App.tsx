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

export default function App(){
  return (
    <BrowserRouter>
      <CampaignProvider>
        <ToastProvider>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Campaigns/>}/>
              <Route path="/campaigns/:id/settings" element={<CampaignSettings/>}/>
              <Route path="/live" element={<LiveRecording/>}/>
              <Route path="/benchmarks" element={<Benchmarks/>}/>
              <Route path="/benchmarks/sessions/:id" element={<SessionBenchmark/>}/>
              <Route path="/characters" element={<Characters/>}/>
              <Route path="/characters/:id" element={<Characters/>}/>
              <Route path="/sessions" element={<Sessions/>}/>
              <Route path="/scenarios" element={<Scenarios/>}/>
              <Route path="/sessions/:id" element={<SessionViewer />} />
            </Routes>
          </AppLayout>
        </ToastProvider>
      </CampaignProvider>
    </BrowserRouter>
  );
}
