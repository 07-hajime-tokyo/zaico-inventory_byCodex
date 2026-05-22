import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import AuthGate from "./components/AuthGate";
import Purchases from "@/pages/Purchases";
import Deliveries from "@/pages/Deliveries";
import DeliveryHistory from "@/pages/DeliveryHistory";
import PurchaseHistory from "@/pages/PurchaseHistory";
import Settings from "@/pages/Settings";
import OrderManagement from "@/pages/OrderManagement";
import DeletedItems from "@/pages/DeletedItems";
import MonthlyReport from "@/pages/MonthlyReport";
import OverseasShipping from "@/pages/OverseasShipping";
import PartnerPortal from "@/pages/PartnerPortal";

/** 記憶対象のパス一覧（NotFoundや404は除外） */
const REMEMBERED_PATHS = [
  "/purchases",
  "/deliveries",
  "/history",
  "/delivery-history",
  "/purchase-history",
  "/order-management",
  "/deleted-items",
  "/monthly-report",
  "/settings",
  "/overseas-shipping",
];

const LAST_PATH_KEY = "zaico_last_path";

/** ページ遷移を監視してlocalStorageに保存するコンポーネント */
function LocationPersister() {
  const [location, setLocation] = useLocation();

  // 現在のパスをlocalStorageに保存
  useEffect(() => {
    if (REMEMBERED_PATHS.includes(location)) {
      localStorage.setItem(LAST_PATH_KEY, location);
    }
  }, [location]);

  // 初回マウント時: "/" にいる場合は保存済みパスに復元
  useEffect(() => {
    if (location === "/") {
      const saved = localStorage.getItem(LAST_PATH_KEY);
      if (saved && REMEMBERED_PATHS.includes(saved)) {
        setLocation(saved);
      } else {
        setLocation("/purchases");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function Router() {
  const [location] = useLocation();
  // /partner/* は取引先専用ポータル（認証不要・DashboardLayout外）
  if (location.startsWith("/partner/")) {
    return (
      <Switch>
        <Route path={"/partner/:code"} component={PartnerPortal} />
      </Switch>
    );
  }
  return (
    <AuthGate>
    <DashboardLayout>
      <LocationPersister />
      <Switch>
        <Route path={"/"} component={Purchases} />
        <Route path={"/purchases"} component={Purchases} />
        <Route path={"/deliveries"} component={Deliveries} />
        <Route path={"/history"} component={DeliveryHistory} />
        <Route path={"/delivery-history"} component={DeliveryHistory} />
        <Route path={"/purchase-history"} component={PurchaseHistory} />
        <Route path={"/order-management"} component={OrderManagement} />
        <Route path={"/deleted-items"} component={DeletedItems} />
        <Route path={"/monthly-report"} component={MonthlyReport} />
        <Route path={"/settings"} component={Settings} />
        <Route path={"/overseas-shipping"} component={OverseasShipping} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
    </AuthGate>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
