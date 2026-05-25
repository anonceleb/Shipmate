import React from "react";
import { CLIENTS, C } from "../data/constants.js";

export default function ClientLink({ id, openScorecard }) {
    const name = CLIENTS.find(c => c.client_id === id)?.name ?? "—";
    return (
      <span onClick={() => openScorecard(id)} style={{ color: C.accent, cursor: "pointer", textDecoration: "underline dotted", textDecorationColor: C.accentDim }}>
        {name}
      </span>
    );
  };