type RouteStatus = {
  scheduledToday: boolean;
  completedToday: boolean;
};

export function routeStatusBadge(route: RouteStatus): { label: string; className: string } {
  if (!route.scheduledToday) {
    return { label: "Not today", className: "bg-gray-100 text-gray-500 border-gray-200" };
  }
  if (route.completedToday) {
    return { label: "Completed", className: "bg-teal-50 text-teal-600 border-teal-200" };
  }
  return { label: "Pending", className: "bg-orange-50 text-orange-600 border-orange-200" };
}








