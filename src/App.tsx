import { Switch, Route, Router as WouterRouter } from "wouter";
import NotFound from "@/pages/not-found";
import TangbirsilRoom from "@/pages/TangbirsilRoom";

export default function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Switch>
        <Route path="/" component={TangbirsilRoom} />
        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}
