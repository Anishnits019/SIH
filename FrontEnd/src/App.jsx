import SuggestPage from "./pages/SuggestPage.jsx";

export default function App() {
  return (
    <SuggestPage
      system=""                 // or "ayurveda" | "siddha" | "unani"
      // apiBase="http://localhost:4000"  // optional override
    />
  );
}
