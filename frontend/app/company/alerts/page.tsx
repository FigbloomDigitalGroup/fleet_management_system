//import AlertsList from "@/components/alerts/AlertsList";
import AlertsList from "../../components/AlertList";


export default function AlertsPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-blue-950">Alerts</h1>
        <p className="text-sm text-gray-500 mt-1">Speeding, idle, and offline notifications</p>
      </div>
      <AlertsList />
    </div>
  );
}