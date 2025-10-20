import React, { useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import MainMenuOverlay from "../components/MainMenu/MainMenuOverlay";

export default function MainMenuPage() {
  const [open, setOpen] = useState(true);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const force = params.get("force") === "1";
  const skipParam = params.get("skip") === "1";
  const silent = params.get("silent") === "1";

  const overrides = useMemo(
    () => ({ force, skipParam, silent }),
    [force, skipParam, silent]
  );

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      if (window.history.length <= 1) navigate("/");
      else navigate(-1);
    }, 150);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0e16" }}>
      <MainMenuOverlay
        open={open}
        onClose={handleClose}
        routeMode
        overrides={overrides}
      />
    </div>
  );
}