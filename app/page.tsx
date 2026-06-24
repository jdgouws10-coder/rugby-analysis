"use client";

import { useEffect, useState } from "react";
import YouTube from "react-youtube";
import { jsPDF } from "jspdf";

type EventLog = {
  id: number;
  time: string;
  seconds: number;
  category: "attack" | "set-piece" | "kick";
  event: string;
  zone: string;
  attackType?: string;
  phases?: number;
  outcome?: string;
  note?: string;
};

type ActiveTool = "home" | "analysis" | "clips" | "moves";

const zones = ["Own 22", "Own Half", "Midfield", "Opp Half", "Opp 22"];
const attackTypes = ["Set Piece", "Transition", "Turnover", "Kick Return"];
const successfulAttackOutcomes = ["Penalty Won", "3 Points", "5 Points", "7 Points"];
const goldZoneSuccessOutcomes = ["3 Points", "5 Points", "7 Points"];

const clipTypeOptions = [
  "Gold Zone Entries",
  "Set Piece Attack",
  "Transition Attack",
  "Turnover Attack",
  "Kick Return Attack",
  "Penalty Won",
  "3 Points",
  "5 Points",
  "7 Points",
  "Ball Lost",
  "Lineout Won",
  "Lineout Lost",
  "Scrum Won",
  "Scrum Lost",
  "Kick Regained",
  "Kick Lost",
  "Good Exit",
  "Bad Exit",
];

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function getYoutubeId(url: string) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/);
  return match ? match[1] : "";
}

function percent(part: number, total: number) {
  if (total === 0) return "0.0";
  return ((part / total) * 100).toFixed(1);
}

function average(values: number[]) {
  if (values.length === 0) return "0.0";
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
}

function parseTimeToSeconds(value: string) {
  if (!value.trim()) return 0;

  const parts = value
    .trim()
    .split(":")
    .map((part) => Number(part));

  if (parts.some((part) => Number.isNaN(part))) return 0;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return parts[0] || 0;
}

function clipLabel(event: EventLog) {
  if (event.category === "attack") {
    return `${event.attackType} Attack • ${event.zone} • ${event.outcome}`;
  }

  if (event.category === "kick") {
    return `Kick Event • ${event.zone} • ${event.outcome}`;
  }

  return `${event.event} • ${event.zone}`;
}

function matchesClipType(event: EventLog, type: string) {
  if (type === "Gold Zone Entries") {
    return event.category === "attack" && event.zone === "Opp 22";
  }

  if (type.endsWith("Attack")) {
    const attackType = type.replace(" Attack", "");
    return event.category === "attack" && event.attackType === attackType;
  }

  if (["Penalty Won", "3 Points", "5 Points", "7 Points", "Ball Lost"].includes(type)) {
    return event.category === "attack" && event.outcome === type;
  }

  if (["Kick Regained", "Kick Lost", "Good Exit", "Bad Exit"].includes(type)) {
    return event.category === "kick" && event.outcome === type;
  }

  return event.event === type;
}

function eventColor(event: EventLog) {
  const outcome = event.outcome || event.event;

  if (["Penalty Won", "3 Points", "5 Points", "7 Points", "Kick Regained", "Good Exit"].includes(outcome)) {
    return "border-green-500/40 bg-green-500/10";
  }

  if (["Ball Lost", "Kick Lost", "Bad Exit"].includes(outcome)) {
    return "border-red-500/40 bg-red-500/10";
  }

  if (["Lineout Won", "Scrum Won"].includes(event.event)) {
    return "border-blue-500/40 bg-blue-500/10";
  }

  if (["Lineout Lost", "Scrum Lost"].includes(event.event)) {
    return "border-orange-500/40 bg-orange-500/10";
  }

  return "border-slate-800 bg-slate-900";
}

export default function Home() {
  const [activeTool, setActiveTool] = useState<ActiveTool>("home");

  const [matchName, setMatchName] = useState("");
  const [opposition, setOpposition] = useState("");
  const [competition, setCompetition] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [player, setPlayer] = useState<any>(null);

  const [events, setEvents] = useState<EventLog[]>([]);
  const [selectedZone, setSelectedZone] = useState("Midfield");

  const [attackActive, setAttackActive] = useState(false);
  const [attackStartZone, setAttackStartZone] = useState("");
  const [currentAttackType, setCurrentAttackType] = useState("");
  const [phaseCount, setPhaseCount] = useState(0);

  const [noteTargetId, setNoteTargetId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [showDashboard, setShowDashboard] = useState(false);
  const [showEventLog, setShowEventLog] = useState(false);

  const [clipSource, setClipSource] = useState<any>(null);
  const [rawVideoName, setRawVideoName] = useState("");
  const [youtubeSyncTime, setYoutubeSyncTime] = useState("00:00");
  const [rawSyncTime, setRawSyncTime] = useState("00:00");
  const [clipBeforeSeconds, setClipBeforeSeconds] = useState(10);
  const [clipAfterSeconds, setClipAfterSeconds] = useState(5);
  const [selectedClipTypes, setSelectedClipTypes] = useState<string[]>(["Gold Zone Entries"]);
  const [generatedClips, setGeneratedClips] = useState<
    {
      type: string;
      clips: { id: number; label: string; originalTime: string; rawStart: number; rawEnd: number }[];
    }[]
  >([]);

  const videoId = getYoutubeId(youtubeUrl);

  const attacks = events.filter((e) => e.category === "attack");
  const totalAttacks = attacks.length;

  const successfulAttacks = attacks.filter((e) =>
    successfulAttackOutcomes.includes(e.outcome || "")
  ).length;

  const ballLosses = attacks.filter((e) => e.outcome === "Ball Lost").length;

  const lineoutsWon = events.filter((e) => e.event === "Lineout Won").length;
  const lineoutsLost = events.filter((e) => e.event === "Lineout Lost").length;
  const totalLineouts = lineoutsWon + lineoutsLost;

  const scrumsWon = events.filter((e) => e.event === "Scrum Won").length;
  const scrumsLost = events.filter((e) => e.event === "Scrum Lost").length;
  const totalScrums = scrumsWon + scrumsLost;

  const kickEvents = events.filter((e) => e.category === "kick");

  const contestableKicks = kickEvents.filter(
    (e) => e.outcome === "Kick Regained" || e.outcome === "Kick Lost"
  );

  const kickRegained = contestableKicks.filter(
    (e) => e.outcome === "Kick Regained"
  ).length;

  const kickLost = contestableKicks.filter((e) => e.outcome === "Kick Lost").length;

  const exitKicks = kickEvents.filter(
    (e) => e.outcome === "Good Exit" || e.outcome === "Bad Exit"
  );

  const goodExits = exitKicks.filter((e) => e.outcome === "Good Exit").length;
  const badExits = exitKicks.filter((e) => e.outcome === "Bad Exit").length;

  const goldZoneEntries = attacks.filter((e) => e.zone === "Opp 22");

  const successfulGoldZoneEntries = goldZoneEntries.filter((e) =>
    goldZoneSuccessOutcomes.includes(e.outcome || "")
  );

  const goldZonePoints = goldZoneEntries.reduce((total, event) => {
    if (event.outcome === "3 Points") return total + 3;
    if (event.outcome === "5 Points") return total + 5;
    if (event.outcome === "7 Points") return total + 7;
    return total;
  }, 0);

  const allPhases = attacks.map((e) => e.phases || 0);

  useEffect(() => {
    const saved = localStorage.getItem("rugby-analysis-v32");

    if (saved) {
      const data = JSON.parse(saved);
      setMatchName(data.matchName || "");
      setOpposition(data.opposition || "");
      setCompetition(data.competition || "");
      setYoutubeUrl(data.youtubeUrl || "");
      setEvents(data.events || []);
    }

    const clipData = localStorage.getItem("rugby-clip-data");
    if (clipData) {
      setClipSource(JSON.parse(clipData));
    }
  }, []);

  function saveMatch() {
    if (!requireTeamNames()) return;

    const data = {
      matchName,
      opposition,
      competition,
      youtubeUrl,
      events,
    };

    localStorage.setItem("rugby-analysis-v32", JSON.stringify(data));
    alert("Match saved on this browser.");
  }

  function clearMatch() {
    const confirmClear = confirm("Clear this match analysis?");
    if (!confirmClear) return;

    localStorage.removeItem("rugby-analysis-v32");
    setMatchName("");
    setOpposition("");
    setCompetition("");
    setYoutubeUrl("");
    setEvents([]);
    setAttackActive(false);
    setAttackStartZone("");
    setCurrentAttackType("");
    setPhaseCount(0);
  }

  function undoLastEvent() {
    setEvents((prev) => prev.slice(1));
  }

  function getVideoSeconds() {
    return player ? player.getCurrentTime() : 0;
  }

  function addSetPiece(eventName: string) {
    const seconds = getVideoSeconds();

    const newEvent: EventLog = {
      id: Date.now(),
      time: formatTime(seconds),
      seconds,
      category: "set-piece",
      event: eventName,
      zone: selectedZone,
    };

    setEvents([newEvent, ...events]);
  }

  function addKick(outcome: string) {
    const seconds = getVideoSeconds();

    const newEvent: EventLog = {
      id: Date.now(),
      time: formatTime(seconds),
      seconds,
      category: "kick",
      event: "Kick Event",
      outcome,
      zone: selectedZone,
    };

    setEvents([newEvent, ...events]);
  }

  function startAttack(type: string) {
    setAttackActive(true);
    setAttackStartZone(selectedZone);
    setCurrentAttackType(type);
    setPhaseCount(0);
  }

  function addPhase() {
    if (attackActive) {
      setPhaseCount((prev) => prev + 1);
    }
  }

  function finishAttack(outcome: string) {
    if (!attackActive) return;

    const seconds = getVideoSeconds();

    const newEvent: EventLog = {
      id: Date.now(),
      time: formatTime(seconds),
      seconds,
      category: "attack",
      event: `${currentAttackType} Attack`,
      attackType: currentAttackType,
      phases: phaseCount,
      outcome,
      zone: attackStartZone,
    };

    setEvents([newEvent, ...events]);

    setAttackActive(false);
    setAttackStartZone("");
    setCurrentAttackType("");
    setPhaseCount(0);
  }

  function jumpTo(seconds: number) {
    if (player) {
      player.seekTo(seconds, true);
      player.playVideo();
    }
  }

  function openNote(event: EventLog) {
    setNoteTargetId(event.id);
    setNoteText(event.note || "");
  }

  function saveNote() {
    if (!noteTargetId) return;

    setEvents((prev) =>
      prev.map((event) =>
        event.id === noteTargetId ? { ...event, note: noteText } : event
      )
    );

    setNoteTargetId(null);
    setNoteText("");
  }

  function exportPDFReport() {
    if (!requireTeamNames()) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 16;
    let y = 18;

    const title = `${matchName || "MATCH ANALYSIS"}${opposition ? ` vs ${opposition}` : ""}`;

    function addSection(titleText: string) {
      y += 8;
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y - 5, pageWidth - margin * 2, 9, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(titleText, margin + 3, y + 1);
      y += 10;
      doc.setTextColor(15, 23, 42);
    }

    function addLine(label: string, value: string | number) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(label, margin, y);
      doc.setFont("helvetica", "bold");
      doc.text(String(value), pageWidth - margin, y, { align: "right" });
      y += 7;
    }

    doc.setFillColor(2, 6, 23);
    doc.rect(0, 0, pageWidth, 32, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("RUGBY STAT REPORT", margin, 14);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(title, margin, 23);

    doc.setTextColor(15, 23, 42);
    y = 42;

    if (competition) {
      addLine("Competition", competition);
    }

    addSection("ATTACK");
    addLine("Total Attacks", totalAttacks);
    addLine("Successful Attacks", successfulAttacks);
    addLine("Attack Efficiency", `${percent(successfulAttacks, totalAttacks)}%`);
    addLine("Ball Losses", ballLosses);
    addLine("Ball Loss Rate", `${percent(ballLosses, totalAttacks)}%`);
    addLine("Average Phases Per Attack", average(allPhases));

    addSection("GOLD ZONE");
    addLine("Entries", goldZoneEntries.length);
    addLine("Successful Entries", successfulGoldZoneEntries.length);
    addLine("Gold Zone Efficiency", `${percent(successfulGoldZoneEntries.length, goldZoneEntries.length)}%`);
    addLine("Points Generated", goldZonePoints);

    addSection("KICKING");
    addLine("Contestable Kicks", contestableKicks.length);
    addLine("Kick Regained", kickRegained);
    addLine("Kick Lost", kickLost);
    addLine("Contestable Kick Effectiveness", `${percent(kickRegained, contestableKicks.length)}%`);
    addLine("Exit Kicks", exitKicks.length);
    addLine("Good Exits", goodExits);
    addLine("Bad Exits", badExits);
    addLine("Exit Success", `${percent(goodExits, exitKicks.length)}%`);

    addSection("SET PIECE");
    addLine("Lineouts", `${lineoutsWon}W / ${lineoutsLost}L`);
    addLine("Lineout Success", `${percent(lineoutsWon, totalLineouts)}%`);
    addLine("Scrums", `${scrumsWon}W / ${scrumsLost}L`);
    addLine("Scrum Success", `${percent(scrumsWon, totalScrums)}%`);

    addSection("ATTACK TYPE BREAKDOWN");
    attackTypes.forEach((type) => {
      const typeAttacks = attacks.filter((a) => a.attackType === type);
      const typeSuccessful = typeAttacks.filter((a) =>
        successfulAttackOutcomes.includes(a.outcome || "")
      ).length;
      addLine(
        type,
        `${typeAttacks.length} attacks | ${typeSuccessful} successful | ${percent(typeSuccessful, typeAttacks.length)}% | Avg phases ${average(typeAttacks.map((a) => a.phases || 0))}`
      );
    });

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Generated by Rugby Analysis Suite", margin, 287);

    doc.save(`${safeFileName(`${matchName} vs ${opposition}`)}-stat-report.pdf`);
  }

  function toggleClipType(type: string) {
    setSelectedClipTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
  }

  function refreshClipData() {
    const clipData = localStorage.getItem("rugby-clip-data");
    const savedMatch = localStorage.getItem("rugby-analysis-v32");

    if (clipData) {
      setClipSource(JSON.parse(clipData));
      alert("Clip data loaded from Compilation Tool package.");
      return;
    }

    if (savedMatch) {
      setClipSource(JSON.parse(savedMatch));
      alert("Saved match loaded for clip creation.");
      return;
    }

    alert("No saved analysis data found yet.");
  }

  function generateClipList() {
    const sourceEvents: EventLog[] = clipSource?.events?.length ? clipSource.events : events;

    if (sourceEvents.length === 0) {
      alert("No events available. Send analysis to the Compilation Tool or import an analysis TXT first.");
      return;
    }

    if (selectedClipTypes.length === 0) {
      alert("Select at least one event type to include.");
      return;
    }

    const offset = parseTimeToSeconds(rawSyncTime) - parseTimeToSeconds(youtubeSyncTime);

    const clipGroups = selectedClipTypes
      .map((type) => {
        const clips = sourceEvents
          .filter((event) => matchesClipType(event, type))
          .slice()
          .reverse()
          .map((event) => {
            const rawEventTime = Math.max(0, event.seconds + offset);
            const rawStart = Math.max(0, rawEventTime - clipBeforeSeconds);
            const rawEnd = Math.max(rawStart + 1, rawEventTime + clipAfterSeconds);

            return {
              id: event.id,
              label: clipLabel(event),
              originalTime: event.time,
              rawStart,
              rawEnd,
            };
          });

        return { type, clips };
      })
      .filter((group) => group.clips.length > 0);

    if (clipGroups.length === 0) {
      alert("No matching events found for the selected clip types.");
      return;
    }

    setGeneratedClips(clipGroups);
  }

  function clearClipData() {
    const confirmClear = confirm("Clear imported/sent compilation data?");
    if (!confirmClear) return;

    localStorage.removeItem("rugby-clip-data");
    setClipSource(null);
    setGeneratedClips([]);
    setRawVideoName("");
  }

  function clearCompilationPreview() {
    setGeneratedClips([]);
  }

  function totalGroupDuration(group: { clips: { rawStart: number; rawEnd: number }[] }) {
    return group.clips.reduce((total, clip) => total + Math.max(0, clip.rawEnd - clip.rawStart), 0);
  }

  function exportClipListTXT() {
    if (generatedClips.length === 0) {
      alert("Generate a clip list first.");
      return;
    }

    const source = clipSource || { matchName, opposition, competition };
    const title = getMatchTitle(source);

    const report = `${title}
${source.competition ? `Competition: ${source.competition}\n` : ""}
CLIP COMPILATION LIST

Sync Offset: ${parseTimeToSeconds(rawSyncTime) - parseTimeToSeconds(youtubeSyncTime)} seconds
Padding: ${clipBeforeSeconds}s before / ${clipAfterSeconds}s after
Selected Compilations: ${selectedClipTypes.join(", ")}

${generatedClips
  .map(
    (group) =>
      `${group.type.toUpperCase()} COMPILATION

${group.clips
  .map(
    (clip, index) =>
      `Clip ${index + 1}: ${clipLabelText(clip.label)}\nOriginal Event Time: ${clip.originalTime}\nRaw Clip: ${formatTime(clip.rawStart)} - ${formatTime(clip.rawEnd)}`
  )
  .join("\n\n")}`
  )
  .join("\n\n------------------------------\n\n")}
`;

    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${safeFileName(title)}-clip-list.txt`;
    link.click();

    URL.revokeObjectURL(url);
  }

  function clipLabelText(label: string) {
    return label.replace(/•/g, "|");
  }

  function safeFileName(value: string) {
    return value
      .trim()
      .replace(/[^a-z0-9\-_\s]/gi, "")
      .replace(/\s+/g, "-")
      .toLowerCase();
  }

  function getMatchTitle(source?: any) {
    const home = source?.matchName || matchName;
    const away = source?.opposition || opposition;

    if (home && away) return `${home} vs ${away}`;
    if (home) return home;
    return "MATCH ANALYSIS";
  }

  function requireTeamNames() {
    if (!matchName.trim() || !opposition.trim()) {
      alert("Please fill in both team names before exporting or sending to the compilation tool.");
      return false;
    }

    return true;
  }

  function sendToCompilationTool() {
    if (!requireTeamNames()) return;

    const clipData = {
      matchName,
      opposition,
      competition,
      youtubeUrl,
      events,
      createdAt: new Date().toISOString(),
      sourceType: "analysis-tool",
    };

    localStorage.setItem("rugby-clip-data", JSON.stringify(clipData));
    setClipSource(clipData);
    setActiveTool("clips");
  }

  function parseAnalysisTextFile(textContent: string, fileName: string) {
    const lines = textContent.split(/\r?\n/);
    const eventLogIndex = lines.findIndex((line) => line.trim().toUpperCase() === "EVENT LOG");

    if (eventLogIndex === -1) {
      alert("No EVENT LOG section found in this TXT file.");
      return;
    }

    const fileBase = fileName.replace(/\.[^/.]+$/, "");
    let importedMatchName = "Imported Match";
    let importedOpposition = "";

    const firstLine = lines.find((line) => line.trim() && !line.toUpperCase().includes("RUGBY ATTACK ANALYSIS REPORT"))?.trim();

    if (firstLine && firstLine.includes(" vs ")) {
      const [home, away] = firstLine.split(" vs ");
      importedMatchName = home.trim() || importedMatchName;
      importedOpposition = away.trim() || "";
    } else if (fileBase.toLowerCase().includes(" vs ")) {
      const [home, away] = fileBase.split(/\s+vs\s+/i);
      importedMatchName = home.trim() || importedMatchName;
      importedOpposition = away.trim() || "";
    } else {
      importedMatchName = fileBase.trim() || importedMatchName;
    }

    const importedCompetitionLine = lines.find((line) => line.startsWith("Competition:"));
    const importedCompetition = importedCompetitionLine
      ? importedCompetitionLine.replace("Competition:", "").trim()
      : "";

    const importedEvents: EventLog[] = [];

    lines.slice(eventLogIndex + 1).forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || !/^\d{1,2}:\d{2}/.test(trimmed)) return;

      const parts = trimmed.split("|").map((part) => part.trim());
      const time = parts[0];
      const eventName = parts[1] || "";
      const zone = parts[2] || "Midfield";
      const notePart = parts.find((part) => part.startsWith("Note:"));
      const note = notePart ? notePart.replace("Note:", "").trim() : undefined;

      if (!eventName) return;

      const baseEvent = {
        id: Date.now() + index,
        time,
        seconds: parseTimeToSeconds(time),
        zone,
        note,
      };

      if (eventName.endsWith("Attack")) {
        const phasePart = parts.find((part) => part.includes("phases"));
        const outcome = parts.find(
          (part, idx) =>
            idx > 2 &&
            !part.includes("phases") &&
            !part.startsWith("Note:")
        );

        importedEvents.push({
          ...baseEvent,
          category: "attack",
          event: eventName,
          attackType: eventName.replace(" Attack", ""),
          phases: phasePart ? Number(phasePart.match(/\d+/)?.[0] || 0) : 0,
          outcome: outcome || "Ball Lost",
        });
        return;
      }

      if (eventName === "Kick Event") {
        importedEvents.push({
          ...baseEvent,
          category: "kick",
          event: "Kick Event",
          outcome: parts[3] || "Kick Lost",
        });
        return;
      }

      importedEvents.push({
        ...baseEvent,
        category: "set-piece",
        event: eventName,
      });
    });

    if (importedEvents.length === 0) {
      alert("No events could be imported from this TXT file.");
      return;
    }

    const importedData = {
      matchName: importedMatchName,
      opposition: importedOpposition,
      competition: importedCompetition === "Not specified" ? "" : importedCompetition,
      youtubeUrl: "",
      events: importedEvents,
      importedFrom: fileName,
      sourceType: "txt-import",
      createdAt: new Date().toISOString(),
    };

    setClipSource(importedData);
    localStorage.setItem("rugby-clip-data", JSON.stringify(importedData));
    setGeneratedClips([]);
    alert(`${importedEvents.length} events imported for compilation.`);
  }

  function importAnalysisTXT(file?: File) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      parseAnalysisTextFile(String(reader.result || ""), file.name);
    };

    reader.readAsText(file);
  }

  if (activeTool === "home") {
    return (
      <main
        className="relative min-h-screen overflow-hidden bg-slate-950 text-white"
        style={{
          backgroundImage: "url('/munster-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/70" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80" />

        <div className="relative z-10 flex min-h-screen flex-col px-8 py-8">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-400/60 bg-black/40 text-2xl">
                🏉
              </div>
              <h1 className="text-2xl font-black uppercase tracking-tight">
                <span className="text-red-500">Rugby</span> Analysis Suite
              </h1>
            </div>

            <div className="rounded-lg border border-white/20 bg-black/30 px-4 py-2 font-bold">
              v4.0.2
            </div>
          </header>

          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.4em] text-red-400">
              Coach Workstation
            </p>
            <h2 className="max-w-5xl text-7xl font-black uppercase leading-none tracking-tight md:text-8xl">
              <span className="block text-red-500">Rugby</span>
              Analysis Suite
            </h2>
            <p className="mt-6 text-2xl text-slate-200">Analyse. Clip. Coach.</p>

            <div className="mt-16 grid w-full max-w-6xl grid-cols-3 gap-6">
              <div className="rounded-3xl border border-white/20 bg-white/10 p-8 text-left shadow-2xl backdrop-blur-md">
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-xl border border-red-400/50 text-4xl text-red-500">
                  📊
                </div>
                <h3 className="mb-4 text-3xl font-black uppercase">Match Analysis</h3>
                <p className="mb-8 text-lg text-slate-200">
                  Analyse matches, log events and generate clean stat sheets.
                </p>
                <button
                  onClick={() => setActiveTool("analysis")}
                  className="w-full rounded-lg bg-red-600 px-5 py-4 text-lg font-bold hover:bg-red-500"
                >
                  Launch Analysis →
                </button>
              </div>

              <div className="rounded-3xl border border-white/20 bg-white/10 p-8 text-left shadow-2xl backdrop-blur-md">
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-xl border border-red-400/50 text-4xl text-red-500">
                  🎬
                </div>
                <h3 className="mb-4 text-3xl font-black uppercase">Auto Clip Creator</h3>
                <p className="mb-8 text-lg text-slate-200">
                  Create highlight compilations from your tagged match events.
                </p>
                <button
                  onClick={() => setActiveTool("clips")}
                  className="w-full rounded-lg bg-red-600 px-5 py-4 text-lg font-bold text-white hover:bg-red-500"
                >
                  Desktop App Info →
                </button>
              </div>

              <div className="rounded-3xl border border-white/20 bg-white/10 p-8 text-left shadow-2xl backdrop-blur-md">
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-xl border border-red-400/50 text-4xl text-red-500">
                  🧠
                </div>
                <h3 className="mb-4 text-3xl font-black uppercase">Moves Designer</h3>
                <p className="mb-8 text-lg text-slate-200">
                  Build, save and present attacking shapes and training moves.
                </p>
                <button
                  onClick={() => setActiveTool("moves")}
                  className="w-full rounded-lg bg-white/20 px-5 py-4 text-lg font-bold text-white hover:bg-white/30"
                >
                  Coming Soon
                </button>
              </div>
            </div>
          </section>

          <footer className="text-center text-sm text-slate-400">
            Rugby Analysis Suite • Personal coaching platform
          </footer>
        </div>
      </main>
    );
  }

  if (activeTool === "clips") {
    return (
      <main
        className="relative min-h-screen overflow-hidden bg-slate-950 p-6 text-white"
        style={{
          backgroundImage: "url('/munster-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/75" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/90" />

        <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col">
          <header className="mb-8 grid grid-cols-3 items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex justify-start">
              <button
                onClick={() => setActiveTool("home")}
                className="rounded-lg border border-white/20 bg-black/30 px-4 py-2 text-sm font-bold transition hover:scale-105 hover:border-cyan-400 hover:bg-slate-800 active:scale-95"
              >
                ← Home
              </button>
            </div>

            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-cyan-400">
                Desktop Required
              </p>
              <h1 className="text-3xl font-black">Auto Clip Creator</h1>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setActiveTool("analysis")}
                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:scale-105 hover:bg-cyan-300 active:scale-95"
              >
                Back to Analysis
              </button>
            </div>
          </header>

          <section className="flex flex-1 items-center justify-center">
            <div className="grid w-full grid-cols-12 gap-6">
              <div className="col-span-7 rounded-3xl border border-white/15 bg-white/10 p-10 shadow-2xl backdrop-blur-md">
                <p className="mb-3 text-sm font-bold uppercase tracking-[0.35em] text-red-400">
                  Video Compilation Engine
                </p>
                <h2 className="mb-5 text-5xl font-black leading-tight">
                  Built for large rugby footage.
                </h2>
                <p className="mb-8 text-lg leading-8 text-slate-200">
                  The Auto Clip Creator runs as a desktop app because full match footage can be several gigabytes. The desktop version uses local FFmpeg processing to handle MOV and MP4 files properly without browser memory limits.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-3xl">🎥</p>
                    <h3 className="mt-3 text-xl font-black">Large MOV/MP4</h3>
                    <p className="mt-2 text-sm text-slate-300">Handles full match files locally on your PC.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-3xl">⚙️</p>
                    <h3 className="mt-3 text-xl font-black">Native FFmpeg</h3>
                    <p className="mt-2 text-sm text-slate-300">Cuts and merges clips using a proper desktop engine.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-3xl">📄</p>
                    <h3 className="mt-3 text-xl font-black">Import Analysis TXT</h3>
                    <p className="mt-2 text-sm text-slate-300">Uses exported event logs from the analysis platform.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-3xl">🏉</p>
                    <h3 className="mt-3 text-xl font-black">Separate Compilations</h3>
                    <p className="mt-2 text-sm text-slate-300">Creates separate videos for each selected category.</p>
                  </div>
                </div>
              </div>

              <div className="col-span-5 rounded-3xl border border-white/15 bg-white/10 p-10 shadow-2xl backdrop-blur-md">
                <p className="mb-3 text-sm font-bold uppercase tracking-[0.35em] text-cyan-400">
                  Coming Next
                </p>
                <h2 className="mb-5 text-4xl font-black">Desktop Download</h2>
                <p className="mb-6 text-slate-300">
                  Once the Windows app is packaged, this page will host the download link.
                </p>

                <button
                  disabled
                  className="mb-4 w-full cursor-not-allowed rounded-lg bg-white/10 px-5 py-4 text-lg font-black text-slate-400 opacity-60"
                >
                  Download Windows App — Coming Soon
                </button>

                <button
                  onClick={() => setActiveTool("analysis")}
                  className="w-full rounded-lg bg-red-600 px-5 py-4 text-lg font-black transition hover:scale-[1.02] hover:bg-red-500 active:scale-95"
                >
                  Open Match Analysis →
                </button>

                <div className="mt-8 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">
                  <h3 className="mb-2 text-lg font-black text-cyan-400">Workflow</h3>
                  <p className="text-sm leading-7 text-slate-200">
                    1. Analyse match on the web platform<br />
                    2. Export or save analysis data<br />
                    3. Open desktop Auto Clip Creator<br />
                    4. Import raw footage and create MP4 compilations
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (activeTool === "moves") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B1120] p-8 text-white">
        <div className="max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-10 text-center shadow-2xl">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.4em] text-cyan-400">
            Coming Soon
          </p>
          <h1 className="mb-4 text-5xl font-black">Moves Designer</h1>
          <p className="mb-8 text-lg text-slate-300">
            This will become the tool for designing and animating rugby moves.
          </p>
          <button
            onClick={() => setActiveTool("home")}
            className="rounded-lg bg-cyan-400 px-6 py-3 font-bold text-slate-950 hover:bg-cyan-300"
          >
            ← Back Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B1120] text-white">
      <div className="sticky top-0 z-40 border-b border-slate-800 bg-[#020617]/95 px-4 py-3 shadow-2xl backdrop-blur">
        <div className="grid grid-cols-3 items-center gap-3">
          <div className="flex justify-start">
            <button
              onClick={() => setActiveTool("home")}
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:scale-105 hover:border-cyan-400 hover:bg-slate-800 active:scale-95"
            >
              ← Home
            </button>
          </div>

          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-cyan-400">
              Match Analysis
            </p>
            <button
              onClick={() => setActiveTool("home")}
              className="text-2xl font-black tracking-tight transition hover:scale-105 hover:text-cyan-400 active:scale-95"
            >
              Rugby Analysis Platform
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={exportPDFReport}
              className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-purple-500/20 transition hover:scale-105 hover:bg-purple-400 active:scale-95"
            >
              Export Stat Report
            </button>

            <button
              onClick={saveMatch}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white transition hover:scale-105 hover:bg-slate-600 active:scale-95"
            >
              Save Match
            </button>

            <button
              onClick={undoLastEvent}
              disabled={events.length === 0}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:scale-105 hover:bg-orange-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Undo Last Event
            </button>

            <button
              onClick={clearMatch}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:scale-105 hover:bg-red-500 active:scale-95"
            >
              Clear Match
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <section className="mb-4 rounded-2xl border border-slate-800 bg-slate-950 p-3 shadow-xl transition hover:border-slate-700">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Match Setup</h2>
            <p className="text-sm text-slate-400">Team names required for exports and compilation</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <input
              className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-white outline-none focus:border-cyan-400"
              placeholder="Your Team *"
              value={matchName}
              onChange={(e) => setMatchName(e.target.value)}
            />

            <input
              className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-white outline-none focus:border-cyan-400"
              placeholder="Opposition *"
              value={opposition}
              onChange={(e) => setOpposition(e.target.value)}
            />

            <input
              className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-white outline-none focus:border-cyan-400"
              placeholder="Competition"
              value={competition}
              onChange={(e) => setCompetition(e.target.value)}
            />
          </div>
        </section>

        <section className="mb-4 grid grid-cols-12 gap-4">
          <div className="col-span-9 rounded-2xl border border-slate-800 bg-slate-950 p-3 shadow-xl transition hover:border-slate-700">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Match Video</h2>
              <p className="text-sm text-slate-400">Watch and tag without scrolling</p>
            </div>

            <input
              className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-white outline-none focus:border-cyan-400"
              placeholder="Paste YouTube match link here"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />

            <div className="mx-auto overflow-hidden rounded-xl border border-slate-800 bg-black">
              {videoId ? (
                <YouTube
                  videoId={videoId}
                  opts={{
                    width: "100%",
                    height: "520",
                    playerVars: {
                      controls: 1,
                    },
                  }}
                  onReady={(event) => setPlayer(event.target)}
                />
              ) : (
                <div className="flex h-[520px] items-center justify-center text-slate-500">
                  Paste a YouTube match link above to load video
                </div>
              )}
            </div>
          </div>

          <div className="col-span-3 rounded-2xl border border-slate-800 bg-slate-950 p-3 shadow-xl transition hover:border-slate-700">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Pitch</h2>
              <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm font-bold text-cyan-400">
                {selectedZone}
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border-2 border-white/70 bg-green-800 shadow-inner">
              <div className="grid h-[520px] grid-rows-5">
                {["Opp 22", "Opp Half", "Midfield", "Own Half", "Own 22"].map((zone, index) => (
                  <button
                    key={zone}
                    onClick={() => setSelectedZone(zone)}
                    className={`relative border-b border-white/50 transition duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                      selectedZone === zone
                        ? "bg-cyan-400 text-slate-950 shadow-[0_0_35px_rgba(34,211,238,0.65)] ring-2 ring-cyan-200/80"
                        : "bg-green-700/80 text-white hover:bg-green-600"
                    } ${index === 4 ? "border-b-0" : ""}`}
                  >
                    <div className="absolute left-2 top-2 text-[10px] font-bold uppercase tracking-widest opacity-70">
                      {index === 0 && "Gold Zone"}
                      {index === 1 && "Launch Zone"}
                      {index === 2 && "Halfway"}
                      {index === 3 && "Exit Zone"}
                      {index === 4 && "Own Goal Area"}
                    </div>

                    <span className="relative z-10 text-lg font-black">{zone}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-4 grid grid-cols-12 gap-4">
          <div className="col-span-6 rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-xl transition hover:border-slate-700">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">Attack Controls</h2>
              {attackActive && (
                <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-bold text-green-400">
                  Active
                </span>
              )}
            </div>

            {attackActive ? (
              <>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-slate-800 p-2.5">
                    <p className="text-xs text-slate-400">Type</p>
                    <p className="font-bold">{currentAttackType}</p>
                  </div>

                  <div className="rounded-lg bg-slate-800 p-2.5">
                    <p className="text-xs text-slate-400">Start Zone</p>
                    <p className="font-bold">{attackStartZone}</p>
                  </div>

                  <div className="rounded-lg bg-slate-800 p-2.5">
                    <p className="text-xs text-slate-400">Phases</p>
                    <p className="font-bold">{phaseCount}</p>
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-2">
                  <button onClick={addPhase} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold transition hover:scale-105 hover:bg-blue-500 active:scale-95">+ Phase</button>
                  <button onClick={() => finishAttack("Penalty Won")} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-bold transition hover:scale-105 hover:bg-green-500 active:scale-95">Penalty Won</button>
                  <button onClick={() => finishAttack("3 Points")} className="rounded-lg bg-green-500 px-3 py-2 text-sm font-bold text-slate-950 transition hover:scale-105 hover:bg-green-400 active:scale-95">3 Points</button>
                  <button onClick={() => finishAttack("5 Points")} className="rounded-lg bg-green-500 px-3 py-2 text-sm font-bold text-slate-950 transition hover:scale-105 hover:bg-green-400 active:scale-95">5 Points</button>
                  <button onClick={() => finishAttack("7 Points")} className="rounded-lg bg-green-500 px-3 py-2 text-sm font-bold text-slate-950 transition hover:scale-105 hover:bg-green-400 active:scale-95">7 Points</button>
                  <button onClick={() => finishAttack("Ball Lost")} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold transition hover:scale-105 hover:bg-red-500 active:scale-95">Ball Lost</button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm text-slate-400">Select zone, then start an attack type.</p>
                <div className="grid grid-cols-4 gap-2">
                  {attackTypes.map((type) => (
                    <button key={type} onClick={() => startAttack(type)} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-bold transition hover:scale-105 hover:bg-green-500 active:scale-95">
                      {type}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="col-span-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-xl transition hover:border-slate-700">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">Kicking</h2>
              <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm font-bold text-cyan-400">
                {selectedZone}
              </span>
            </div>

            {selectedZone === "Own 22" ? (
              <>
                <p className="mb-3 text-xs text-slate-400">Own 22 kicks are exits.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => addKick("Good Exit")} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 transition hover:scale-105 hover:bg-cyan-400 active:scale-95">Good Exit</button>
                  <button onClick={() => addKick("Bad Exit")} className="rounded-lg bg-red-700 px-3 py-2 text-sm font-bold transition hover:scale-105 hover:bg-red-600 active:scale-95">Bad Exit</button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-3 text-xs text-slate-400">Outside Own 22 = contestable/tactical.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => addKick("Kick Regained")} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 transition hover:scale-105 hover:bg-cyan-400 active:scale-95">Regained</button>
                  <button onClick={() => addKick("Kick Lost")} className="rounded-lg bg-red-700 px-3 py-2 text-sm font-bold transition hover:scale-105 hover:bg-red-600 active:scale-95">Lost</button>
                </div>
              </>
            )}
          </div>

          <div className="col-span-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-xl transition hover:border-slate-700">
            <h2 className="mb-3 text-xl font-bold">Set Piece</h2>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => addSetPiece("Lineout Won")} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold transition hover:scale-105 hover:bg-blue-500 active:scale-95">Lineout Won</button>
              <button onClick={() => addSetPiece("Lineout Lost")} className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-bold transition hover:scale-105 hover:bg-orange-500 active:scale-95">Lineout Lost</button>
              <button onClick={() => addSetPiece("Scrum Won")} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold transition hover:scale-105 hover:bg-blue-500 active:scale-95">Scrum Won</button>
              <button onClick={() => addSetPiece("Scrum Lost")} className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-bold transition hover:scale-105 hover:bg-orange-500 active:scale-95">Scrum Lost</button>
            </div>
          </div>
        </section>

        <button
          onClick={() => setShowDashboard(!showDashboard)}
          className="mb-4 flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 p-4 text-left shadow-xl transition hover:scale-[1.01] hover:border-cyan-400 active:scale-[0.99]"
        >
          <div>
            <h2 className="text-xl font-black">
              {showDashboard ? "▼ Dashboard" : "▶ Dashboard"}
            </h2>
            <p className="text-sm text-slate-400">
              Attack, Gold Zone, Kicking, Set Piece and Attack Type stats
            </p>
          </div>
          <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm font-bold text-cyan-400">
            {totalAttacks} attacks
          </span>
        </button>

        {showDashboard && (
          <>
        <section className="mb-6 grid grid-cols-5 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Total Attacks</p>
            <p className="mt-2 text-5xl font-black">{totalAttacks}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Attack Efficiency</p>
            <p className="mt-2 text-4xl font-black text-green-400">{percent(successfulAttacks, totalAttacks)}%</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Ball Loss Rate</p>
            <p className="mt-2 text-4xl font-black text-red-400">{percent(ballLosses, totalAttacks)}%</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Lineout Success</p>
            <p className="mt-2 text-4xl font-black">{percent(lineoutsWon, totalLineouts)}%</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Scrum Success</p>
            <p className="mt-2 text-4xl font-black">{percent(scrumsWon, totalScrums)}%</p>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Gold Zone Efficiency</p>
            <p className="mt-2 text-4xl font-black text-yellow-400">{percent(successfulGoldZoneEntries.length, goldZoneEntries.length)}%</p>
            <p className="mt-1 text-sm text-slate-400">{successfulGoldZoneEntries.length}/{goldZoneEntries.length} entries</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Gold Zone Points</p>
            <p className="mt-2 text-4xl font-black text-yellow-400">{goldZonePoints}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Contestable Kicks</p>
            <p className="mt-2 text-4xl font-black">{percent(kickRegained, contestableKicks.length)}%</p>
            <p className="mt-1 text-sm text-slate-400">{kickRegained} regained / {kickLost} lost</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Exit Success</p>
            <p className="mt-2 text-4xl font-black">{percent(goodExits, exitKicks.length)}%</p>
            <p className="mt-1 text-sm text-slate-400">{goodExits} good / {badExits} bad</p>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-4 gap-4">
          {attackTypes.map((type) => {
            const typeAttacks = attacks.filter((a) => a.attackType === type);
            const typeSuccessful = typeAttacks.filter((a) => successfulAttackOutcomes.includes(a.outcome || "")).length;
            return (
              <div key={type} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">{type}</p>
                <p className="mt-2 text-2xl font-black">{percent(typeSuccessful, typeAttacks.length)}%</p>
                <p className="text-sm text-slate-400">{typeSuccessful}/{typeAttacks.length} successful</p>
                <p className="text-sm text-slate-400">Avg phases: {average(typeAttacks.map((a) => a.phases || 0))}</p>
              </div>
            );
          })}
        </section>

          </>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-xl transition hover:border-slate-700">
          <button
            onClick={() => setShowEventLog(!showEventLog)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <h2 className="text-xl font-black">
                {showEventLog ? `▼ Event Log (${events.length})` : `▶ Event Log (${events.length})`}
              </h2>
              <p className="text-sm text-slate-400">Click timestamp to jump. Add notes if needed.</p>
            </div>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-bold text-slate-300">
              {events.length} events
            </span>
          </button>

          {showEventLog && (
            <div className="mt-4">
              {events.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
                  No events tagged yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((item) => (
                    <div key={item.id} className={`rounded-lg border p-3 ${eventColor(item)}`}>
                      <div className="grid grid-cols-5 items-center gap-3">
                        <button onClick={() => jumpTo(item.seconds)} className="text-left font-mono text-cyan-400 hover:underline">
                          {item.time}
                        </button>

                        <span className="font-bold">
                          {item.category === "attack" ? `${item.attackType} Attack` : item.event}
                        </span>

                        <span className="text-slate-300">{item.zone}</span>

                        <span className="text-slate-300">
                          {item.category === "attack"
                            ? `${item.phases} phases | ${item.outcome}`
                            : item.category === "kick"
                            ? item.outcome
                            : "Set Piece"}
                        </span>

                        <button onClick={() => openNote(item)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold hover:bg-slate-700">
                          {item.note ? "Edit Note" : "Add Note"}
                        </button>
                      </div>

                      {item.note && (
                        <p className="mt-2 rounded-lg bg-slate-950/60 p-2 text-sm text-slate-300">
                          Note: {item.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {noteTargetId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl">
              <h2 className="mb-4 text-xl font-bold">Add Event Note</h2>
              <textarea
                className="mb-4 h-32 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-cyan-400"
                placeholder="Example: Forward pass after launch..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setNoteTargetId(null);
                    setNoteText("");
                  }}
                  className="rounded-lg bg-slate-700 px-4 py-2 font-bold hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button onClick={saveNote} className="rounded-lg bg-cyan-400 px-4 py-2 font-bold text-slate-950 hover:bg-cyan-300">
                  Save Note
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
