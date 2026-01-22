import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import { CampaignProvider } from './context/CampaignContext';
import Campaigns from './pages/Campaigns';
import Characters from './pages/Characters';

export default function App(){
  return (
    <BrowserRouter>
      <CampaignProvider>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Campaigns/>}/>
            <Route path="/characters" element={<Characters/>}/>
          </Routes>
        </AppLayout>
      </CampaignProvider>
    </BrowserRouter>
  );
}
