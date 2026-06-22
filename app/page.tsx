"use client";

import { useEffect, useState } from "react";
import YouTube from "react-youtube";

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

const zones = ["Own 22", "Own Half", "Midfield", "Opp Half", "Opp 22"];

const attackTypes = [
  "Set Piece",
  "Transition",
  "Turnover",
  "Kick Return",
];

const successfulAttackOutcomes = [
  "Penalty Won",
  "3 Points",
  "5 Points",
  "7 Points",
];

const goldZoneSuccessOutcomes = ["3 Points", "5 Points", "7 Points"];

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

function getYoutubeId(url: string) {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/
  );

  return match ? match[1] : "";
}

function percent(part: number, total: number) {
  if (total === 0) return "0.0";
  return ((part / total) * 100).toFixed(1);
}

function average(values: number[]) {
  if (values.length === 0) return "0.0";
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(
    1
  );
}

function eventColor(event: EventLog) {
  const outcome = event.outcome || event.event;

  if (
    ["Penalty Won", "3 Points", "5 Points", "7 Points", "Kick Regained", "Good Exit"].includes(
      outcome
    )
  ) {
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
  const successfulPhases = attacks
    .filter((e) => successfulAttackOutcomes.includes(e.outcome || ""))
    .map((e) => e.phases || 0);
  const failedPhases = attacks
    .filter((e) => e.outcome === "Ball Lost")
    .map((e) => e.phases || 0);

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
  }, []);

  function saveMatch() {
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

  function exportToTXT() {
    const attackTypeReport = attackTypes
      .map((type) => {
        const typeAttacks = attacks.filter((a) => a.attackType === type);
        const typeSuccessful = typeAttacks.filter((a) =>
          successfulAttackOutcomes.includes(a.outcome || "")
        ).length;

        return `${type.toUpperCase()}
Attacks: ${typeAttacks.length}
Successful: ${typeSuccessful}
Efficiency: ${percent(typeSuccessful, typeAttacks.length)}%
Average Phases: ${average(typeAttacks.map((a) => a.phases || 0))}`;
      })
      .join("\n\n");

    const report = `
${matchName || "MATCH ANALYSIS"}${opposition ? ` vs ${opposition}` : ""}

Competition: ${competition || "Not specified"}

RUGBY ATTACK ANALYSIS REPORT

ATTACK SUMMARY
Total Attacks: ${totalAttacks}
Successful Attacks: ${successfulAttacks}
Attack Efficiency: ${percent(successfulAttacks, totalAttacks)}%

Ball Losses: ${ballLosses}
Ball Loss Rate: ${percent(ballLosses, totalAttacks)}%

SET PIECE
Lineouts Won: ${lineoutsWon}
Lineouts Lost: ${lineoutsLost}
Lineout Success: ${percent(lineoutsWon, totalLineouts)}%

Scrums Won: ${scrumsWon}
Scrums Lost: ${scrumsLost}
Scrum Success: ${percent(scrumsWon, totalScrums)}%

CONTESTABLE KICKING
Total Contestable Kicks: ${contestableKicks.length}
Kick Regained: ${kickRegained}
Kick Lost: ${kickLost}
Contestable Kick Effectiveness: ${percent(kickRegained, contestableKicks.length)}%

EXIT KICKING
Good Exits: ${goodExits}
Bad Exits: ${badExits}
Exit Success: ${percent(goodExits, exitKicks.length)}%

GOLD ZONE
Gold Zone Entries: ${goldZoneEntries.length}
Successful Gold Zone Entries: ${successfulGoldZoneEntries.length}
Gold Zone Efficiency: ${percent(successfulGoldZoneEntries.length, goldZoneEntries.length)}%
Points Generated From Gold Zone: ${goldZonePoints}

PHASE ANALYSIS
Average Phases Per Attack: ${average(allPhases)}
Average Phases Successful Attacks: ${average(successfulPhases)}
Average Phases Failed Attacks: ${average(failedPhases)}

ATTACK TYPE BREAKDOWN

${attackTypeReport}

EVENT LOG

${events
  .slice()
  .reverse()
  .map((e) => {
    if (e.category === "attack") {
      return `${e.time} | ${e.attackType} Attack | ${e.zone} | ${e.phases} phases | ${e.outcome}${
        e.note ? ` | Note: ${e.note}` : ""
      }`;
    }

    if (e.category === "kick") {
      return `${e.time} | Kick Event | ${e.zone} | ${e.outcome}${
        e.note ? ` | Note: ${e.note}` : ""
      }`;
    }

    return `${e.time} | ${e.event} | ${e.zone}${e.note ? ` | Note: ${e.note}` : ""}`;
  })
  .join("\n")}
`;

    const blob = new Blob([report], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${matchName || "rugby-analysis"}-report.txt`;
    link.click();

    URL.revokeObjectURL(url);
  }  return (
    <main className="min-h-screen bg-[#0B1120] text-white">
      <div className="border-b border-slate-800 bg-[#020617] px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">
              Attack Analysis
            </p>
            <h1 className="text-4xl font-black tracking-tight">
              Rugby Analysis Platform
            </h1>
          </div>

          <div className="text-right">
            <p className="text-sm text-slate-400">Session Status</p>
            <p className="font-bold text-green-400">Analysis Ready</p>
          </div>
        </div>
      </div>

      <div className="p-8">
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Match Setup</h2>
            <p className="text-sm text-slate-400">V3.2 Analyst Mode</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <input
              className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-cyan-400"
              placeholder="Your Team"
              value={matchName}
              onChange={(e) => setMatchName(e.target.value)}
            />

            <input
              className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-cyan-400"
              placeholder="Opposition"
              value={opposition}
              onChange={(e) => setOpposition(e.target.value)}
            />

            <input
              className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-cyan-400"
              placeholder="Competition"
              value={competition}
              onChange={(e) => setCompetition(e.target.value)}
            />
          </div>
        </section>

        <section className="mb-6 grid grid-cols-5 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Total Attacks
            </p>
            <p className="mt-2 text-5xl font-black">{totalAttacks}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Attack Efficiency
            </p>
            <p className="mt-2 text-4xl font-black text-green-400">
              {percent(successfulAttacks, totalAttacks)}%
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Ball Loss Rate
            </p>
            <p className="mt-2 text-4xl font-black text-red-400">
              {percent(ballLosses, totalAttacks)}%
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Lineout Success
            </p>
            <p className="mt-2 text-4xl font-black">
              {percent(lineoutsWon, totalLineouts)}%
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Scrum Success
            </p>
            <p className="mt-2 text-4xl font-black">
              {percent(scrumsWon, totalScrums)}%
            </p>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Gold Zone Efficiency
            </p>
            <p className="mt-2 text-4xl font-black text-yellow-400">
              {percent(successfulGoldZoneEntries.length, goldZoneEntries.length)}%
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {successfulGoldZoneEntries.length}/{goldZoneEntries.length} entries
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Gold Zone Points
            </p>
            <p className="mt-2 text-4xl font-black text-yellow-400">
              {goldZonePoints}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Contestable Kicks
            </p>
            <p className="mt-2 text-4xl font-black">
              {percent(kickRegained, contestableKicks.length)}%
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {kickRegained} regained / {kickLost} lost
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Exit Success
            </p>
            <p className="mt-2 text-4xl font-black">
              {percent(goodExits, exitKicks.length)}%
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {goodExits} good / {badExits} bad
            </p>
          </div>
        </section>

        <section className="mb-6 flex gap-3">
          <button
            onClick={exportToTXT}
            className="rounded-lg bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300"
          >
            Export TXT Report
          </button>

          <button
            onClick={saveMatch}
            className="rounded-lg bg-slate-700 px-5 py-3 font-bold text-white hover:bg-slate-600"
          >
            Save Match
          </button>

          <button
            onClick={undoLastEvent}
            disabled={events.length === 0}
            className="rounded-lg bg-orange-500 px-5 py-3 font-bold text-slate-950 hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Undo Last Event
          </button>

          <button
            onClick={clearMatch}
            className="rounded-lg bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-500"
          >
            Clear Match
          </button>
        </section>

        <section className="grid grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Match Video</h2>
              <p className="text-sm text-slate-400">
                Timestamp synced tagging
              </p>
            </div>

            <input
              className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-cyan-400"
              placeholder="Paste YouTube match link here"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />

            <div className="overflow-hidden rounded-xl border border-slate-800 bg-black">
              {videoId ? (
                <YouTube
                  videoId={videoId}
                  opts={{
                    width: "100%",
                    height: "390",
                    playerVars: {
                      controls: 1,
                    },
                  }}
                  onReady={(event) => setPlayer(event.target)}
                />
              ) : (
                <div className="flex h-[390px] items-center justify-center text-slate-500">
                  Paste a YouTube match link above to load video
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Interactive Pitch</h2>
              <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm font-bold text-cyan-400">
                Selected Zone: {selectedZone}
              </span>
            </div>

            <div className="mb-6 overflow-hidden rounded-2xl border-2 border-white/70 bg-green-800 shadow-inner">
              <div className="grid h-40 grid-cols-5">
                {zones.map((zone, index) => (
                  <button
                    key={zone}
                    onClick={() => setSelectedZone(zone)}
                    className={`relative border-r border-white/50 transition ${
                      selectedZone === zone
                        ? "bg-cyan-400 text-slate-950"
                        : "bg-green-700/80 text-white hover:bg-green-600"
                    } ${index === zones.length - 1 ? "border-r-0" : ""}`}
                  >
                    <div className="absolute left-1 top-1 text-[10px] font-bold uppercase tracking-widest opacity-70">
                      {index === 0 && "Try Line"}
                      {index === 1 && "22m"}
                      {index === 2 && "Halfway"}
                      {index === 3 && "22m"}
                      {index === 4 && "Try Line"}
                    </div>

                    <span className="relative z-10 text-sm font-black">
                      {zone}
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-5 border-t border-white/40 bg-green-900 text-center text-[10px] font-bold uppercase tracking-widest text-white/70">
                <div>Own Goal Area</div>
                <div>Exit Zone</div>
                <div>Middle Third</div>
                <div>Launch Zone</div>
                <div>Gold Zone</div>
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">Current Attack</h2>
                {attackActive && (
                  <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-bold text-green-400">
                    Active
                  </span>
                )}
              </div>

              {attackActive ? (
                <>
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-slate-800 p-3">
                      <p className="text-xs text-slate-400">Type</p>
                      <p className="font-bold">{currentAttackType}</p>
                    </div>

                    <div className="rounded-lg bg-slate-800 p-3">
                      <p className="text-xs text-slate-400">Start Zone</p>
                      <p className="font-bold">{attackStartZone}</p>
                    </div>

                    <div className="rounded-lg bg-slate-800 p-3">
                      <p className="text-xs text-slate-400">Phases</p>
                      <p className="font-bold">{phaseCount}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={addPhase}
                      className="rounded-lg bg-blue-600 p-3 font-bold hover:bg-blue-500"
                    >
                      + Phase
                    </button>

                    <button
                      onClick={() => finishAttack("Penalty Won")}
                      className="rounded-lg bg-green-600 p-3 font-bold hover:bg-green-500"
                    >
                      Penalty Won
                    </button>

                    <button
                      onClick={() => finishAttack("3 Points")}
                      className="rounded-lg bg-green-500 p-3 font-bold text-slate-950 hover:bg-green-400"
                    >
                      3 Points
                    </button>

                    <button
                      onClick={() => finishAttack("5 Points")}
                      className="rounded-lg bg-green-500 p-3 font-bold text-slate-950 hover:bg-green-400"
                    >
                      5 Points
                    </button>

                    <button
                      onClick={() => finishAttack("7 Points")}
                      className="rounded-lg bg-green-500 p-3 font-bold text-slate-950 hover:bg-green-400"
                    >
                      7 Points
                    </button>

                    <button
                      onClick={() => finishAttack("Ball Lost")}
                      className="rounded-lg bg-red-600 p-3 font-bold hover:bg-red-500"
                    >
                      Ball Lost
                    </button>

                  </div>
                </>
              ) : (
                <>
                  <p className="mb-3 text-slate-400">
                    Select zone, then start an attack type.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    {attackTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => startAttack(type)}
                        className="rounded-lg bg-green-600 p-3 font-bold hover:bg-green-500"
                      >
                        {type} Attack
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <h2 className="mb-4 text-xl font-bold">Kicking Events</h2>

            <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-bold">Selected Kick Zone</p>
                <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm font-bold text-cyan-400">
                  {selectedZone}
                </span>
              </div>

              {selectedZone === "Own 22" ? (
                <>
                  <p className="mb-3 text-sm text-slate-400">
                    Own 22 kicks are logged as exit kicks and do not count toward contestable kick effectiveness.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => addKick("Good Exit")}
                      className="rounded-lg bg-cyan-500 p-3 font-bold text-slate-950 hover:bg-cyan-400"
                    >
                      Good Exit
                    </button>

                    <button
                      onClick={() => addKick("Bad Exit")}
                      className="rounded-lg bg-red-700 p-3 font-bold hover:bg-red-600"
                    >
                      Bad Exit
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-3 text-sm text-slate-400">
                    Kicks outside Own 22 are logged as contestable/tactical kicks.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => addKick("Kick Regained")}
                      className="rounded-lg bg-cyan-500 p-3 font-bold text-slate-950 hover:bg-cyan-400"
                    >
                      Kick Regained
                    </button>

                    <button
                      onClick={() => addKick("Kick Lost")}
                      className="rounded-lg bg-red-700 p-3 font-bold hover:bg-red-600"
                    >
                      Kick Lost
                    </button>
                  </div>
                </>
              )}
            </div>

            <h2 className="mb-4 text-xl font-bold">Set Piece Events</h2>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => addSetPiece("Lineout Won")}
                className="rounded-lg bg-blue-600 p-3 font-bold hover:bg-blue-500"
              >
                Lineout Won
              </button>

              <button
                onClick={() => addSetPiece("Lineout Lost")}
                className="rounded-lg bg-orange-600 p-3 font-bold hover:bg-orange-500"
              >
                Lineout Lost
              </button>

              <button
                onClick={() => addSetPiece("Scrum Won")}
                className="rounded-lg bg-blue-600 p-3 font-bold hover:bg-blue-500"
              >
                Scrum Won
              </button>

              <button
                onClick={() => addSetPiece("Scrum Lost")}
                className="rounded-lg bg-orange-600 p-3 font-bold hover:bg-orange-500"
              >
                Scrum Lost
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-3 gap-4">
          {attackTypes.map((type) => {
            const typeAttacks = attacks.filter((a) => a.attackType === type);
            const typeSuccessful = typeAttacks.filter((a) =>
              successfulAttackOutcomes.includes(a.outcome || "")
            ).length;

            return (
              <div
                key={type}
                className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
              >
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  {type}
                </p>
                <p className="mt-2 text-2xl font-black">
                  {percent(typeSuccessful, typeAttacks.length)}%
                </p>
                <p className="text-sm text-slate-400">
                  {typeSuccessful}/{typeAttacks.length} successful
                </p>
                <p className="text-sm text-slate-400">
                  Avg phases: {average(typeAttacks.map((a) => a.phases || 0))}
                </p>
              </div>
            );
          })}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Event Log</h2>
            <p className="text-sm text-slate-400">
              Click timestamp area to jump. Add notes if needed.
            </p>
          </div>

          {events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
              No events tagged yet.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3 ${eventColor(item)}`}
                >
                  <div className="grid grid-cols-5 items-center gap-3">
                    <button
                      onClick={() => jumpTo(item.seconds)}
                      className="text-left font-mono text-cyan-400 hover:underline"
                    >
                      {item.time}
                    </button>

                    <span className="font-bold">
                      {item.category === "attack"
                        ? `${item.attackType} Attack`
                        : item.category === "kick"
                        ? "Kick Event"
                        : item.event}
                    </span>

                    <span className="text-slate-300">{item.zone}</span>

                    <span className="text-slate-300">
                      {item.category === "attack"
                        ? `${item.phases} phases | ${item.outcome}`
                        : item.category === "kick"
                        ? item.outcome
                        : "Set Piece"}
                    </span>

                    <button
                      onClick={() => openNote(item)}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold hover:bg-slate-700"
                    >
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

                <button
                  onClick={saveNote}
                  className="rounded-lg bg-cyan-400 px-4 py-2 font-bold text-slate-950 hover:bg-cyan-300"
                >
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
