import Dashboard from './pages/Dashboard';
import TradeAssistant from './pages/TradeAssistant';
import TradeDetail from './pages/TradeDetail';
import Compliance from './pages/Compliance';
import Finance from './pages/Finance';
import Payments from './pages/Payments';
import Proofs from './pages/Proofs';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "TradeAssistant": TradeAssistant,
    "TradeDetail": TradeDetail,
    "Compliance": Compliance,
    "Finance": Finance,
    "Payments": Payments,
    "Proofs": Proofs,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};