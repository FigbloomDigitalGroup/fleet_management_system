//import AlertsList from "@/components/alerts/AlertsList";
import AlertsList from "../../components/AlertList";


export default function AlertsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
        <p className="text-sm text-gray-500 mt-1">Speeding, idle, and offline notifications</p>
      </div>
      <AlertsList />
    </div>
  );
}