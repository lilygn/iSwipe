import React from "react";
import SavedProfList from "../(tabs)/Saved"; 
import { useSavedProfs } from "../(tabs)/savedProfContext";

export default function SavedScreen() {
  const { savedProfs, removeProf, clearProfs } = useSavedProfs();

  return (
    <SavedProfList
      items={savedProfs}
      onRemove={removeProf}      
      onClear={clearProfs}
      onOpen={(prof) => {

         if (prof.profileURL) Linking.openURL(prof.profileURL);
        console.log("Open", prof.name);
      }}
    />
  );
}
