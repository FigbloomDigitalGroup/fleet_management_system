import { ContentLoading } from "../components/FullPageLoading";

// Shown in the content pane while the next page loads; the menu and header
// (this area's layout) stay on screen.
export default function Loading() {
  return <ContentLoading />;
}
