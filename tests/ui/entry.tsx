import { createRoot } from "react-dom/client";
import Liflow from "../../app/liflow";
import "../../app/globals.css";
import "../../app/diary.css";
createRoot(document.getElementById("root")!).render(<Liflow userName="サンプル@liflow.test" userId="fixture-user" onSignOut={() => {}} />);
