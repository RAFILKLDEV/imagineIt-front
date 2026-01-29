import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import { CampaignProvider } from './context/CampaignContext';
import Campaigns from './pages/Campaigns';
import Characters from './pages/Characters';
import Sessions from './pages/Sessions';
import Scenarios from './pages/Scenarios';
import { ToastProvider } from './components/ToastProvider';
import SessionViewer from './pages/SessionViewer';

export default function App(){
  return (
    <BrowserRouter>
      <CampaignProvider>
        <ToastProvider>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Campaigns/>}/>
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
