// SavedScreen.jsx
import React from "react";
import SavedProfList from "../(tabs)/Saved"; // <- your file above
import { useSavedProfs } from "../(tabs)/savedProfContext";

export default function SavedScreen() {
  const { savedProfs, removeProf, clearProfs } = useSavedProfs();

  return (
    <SavedProfList
      items={savedProfs}
      onRemove={removeProf}      // accepts id or object
      onClear={clearProfs}
      onOpen={(prof) => {

        // e.g. open a detail sheet, or:
         if (prof.profileURL) Linking.openURL(prof.profileURL);
        console.log("Open", prof.name);
      }}
    />
  );
}
