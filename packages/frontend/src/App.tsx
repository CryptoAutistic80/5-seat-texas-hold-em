import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { WalletProvider } from "./components/wallet-provider";
import { Header } from "./components/Header";
import { Home } from "./pages/Home";
import { Table } from "./pages/Table";
import "./App.css";

function AppShell() {
  const location = useLocation();
  const isTableRoute = location.pathname.startsWith("/table/");

  return (
    <div className="app">
      <Header />
      <main className={`main-content${isTableRoute ? " table-mode" : ""}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/table/:address" element={<Table />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <WalletProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppShell />
      </BrowserRouter>
    </WalletProvider>
  );
}

export default App;
