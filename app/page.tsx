"use client";

import { useEffect, useState } from "react";
import YouTube from "react-youtube";

type EventLog = {
  id: number;
  time: string;
  seconds: number;
  event: string;
  zone: string;
};

const zones = ["Own 22", "Own Half", "Midfield", "Opp Half", "Opp 22"];

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
  const [phaseCount, setPhaseCount] = useState(0);

  const videoId = getYoutubeId(youtubeUrl);

  const totalAttacks = events.filter((e) => e.event.startsWith("Attack")).length;
  const tries = events.filter((e) => e.event.includes("Try")).length;
  const ballLosses = events.filter((e) => e.event.includes("Ball Lost")).length;
  const lineoutsWon = events.filter((e) => e.event === "Lineout Won").length;
  const lineoutsLost = events.filter((e) => e.event === "Lineout Lost").length;
  const scrumsWon = events.filter((e) => e.event === "Scrum Won").length;
  const scrumsLost = events.filter((e) => e.event === "Scrum Lost").length;

  useEffect(() => {
    const saved = localStorage.getItem("rugby-analysis-v2");

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

    localStorage.setItem("rugby-analysis-v2", JSON.stringify(data));
    alert("Match saved on this browser.");
  }

  function clearMatch() {
    const confirmClear = confirm("Clear this match analysis?");
    if (!confirmClear) return;

    localStorage.removeItem("rugby-analysis-v2");
    setMatchName("");
    setOpposition("");
    setCompetition("");
    setYoutubeUrl("");
    setEvents([]);
    setAttackActive(false);
    setAttackStartZone("");
    setPhaseCount(0);
  }

  function undoLastEvent() {
    setEvents((prev) => prev.slice(1));
  }

  function getVideoSeconds() {
    return player ? player.getCurrentTime() : 0;
  }

  function addEvent(eventName: string) {
    const seconds = getVideoSeconds();

    const newEvent: EventLog = {
      id: Date.now(),
      time: formatTime(seconds),
      seconds,
      event: eventName,
      zone: selectedZone,
    };

    setEvents([newEvent, ...events]);
  }

  function startAttack() {
    setAttackActive(true);
    setAttackStartZone(selectedZone);
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
      event: `Attack (${phaseCount} phases) → ${outcome}`,
      zone: attackStartZone,
    };

    setEvents([newEvent, ...events]);

    setAttackActive(false);
    setAttackStartZone("");
    setPhaseCount(0);
  }

  function jumpTo(seconds: number) {
    if (player) {
      player.seekTo(seconds, true);
      player.playVideo();
    }
  }

  function exportToTXT() {
    const report = `
${matchName || "MATCH ANALYSIS"}${opposition ? ` vs ${opposition}` : ""}

Competition: ${competition || "Not specified"}

RUGBY ATTACK ANALYSIS REPORT

ATTACK
Total Attacks: ${totalAttacks}
Tries: ${tries}
Ball Losses: ${ballLosses}

LINEOUTS
Won: ${lineoutsWon}
Lost: ${lineoutsLost}
Total: ${lineoutsWon + lineoutsLost}

SCRUMS
Won: ${scrumsWon}
Lost: ${scrumsLost}
Total: ${scrumsWon + scrumsLost}

EVENT LOG

${events
  .slice()
  .reverse()
  .map((e) => `${e.time} | ${e.event} | ${e.zone}`)
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
  }

  return (
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
            <p className="text-sm text-slate-400">Single-session local save</p>
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
              Tries
            </p>
            <p className="mt-2 text-5xl font-black text-green-400">{tries}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Ball Losses
            </p>
            <p className="mt-2 text-5xl font-black text-red-400">
              {ballLosses}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Lineouts
            </p>
            <p className="mt-2 text-4xl font-black">
              {lineoutsWon}W / {lineoutsLost}L
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Scrums
            </p>
            <p className="mt-2 text-4xl font-black">
              {scrumsWon}W / {scrumsLost}L
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
              <div className="grid h-44 grid-cols-5">
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

                    <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />

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
                <div>Red Zone</div>
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
                  <div className="mb-4 grid grid-cols-2 gap-3">
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
                      onClick={() => finishAttack("Try")}
                      className="rounded-lg bg-green-500 p-3 font-bold text-slate-950 hover:bg-green-400"
                    >
                      Try
                    </button>

                    <button
                      onClick={() => finishAttack("Ball Lost")}
                      className="rounded-lg bg-red-600 p-3 font-bold hover:bg-red-500"
                    >
                      Ball Lost
                    </button>

                    <button
                      onClick={() => finishAttack("Penalty Won")}
                      className="rounded-lg bg-cyan-500 p-3 font-bold text-slate-950 hover:bg-cyan-400"
                    >
                      Penalty Won
                    </button>

                    <button
                      onClick={() => finishAttack("Kick")}
                      className="col-span-2 rounded-lg bg-slate-700 p-3 font-bold hover:bg-slate-600"
                    >
                      Kick
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-slate-400">No active attack</p>
              )}
            </div>

            <h2 className="mb-4 text-xl font-bold">Attack Coach Events</h2>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => addEvent("Lineout Won")}
                className="rounded-lg bg-blue-600 p-3 font-bold hover:bg-blue-500"
              >
                Lineout Won
              </button>

              <button
                onClick={() => addEvent("Lineout Lost")}
                className="rounded-lg bg-red-600 p-3 font-bold hover:bg-red-500"
              >
                Lineout Lost
              </button>

              <button
                onClick={() => addEvent("Scrum Won")}
                className="rounded-lg bg-blue-600 p-3 font-bold hover:bg-blue-500"
              >
                Scrum Won
              </button>

              <button
                onClick={() => addEvent("Scrum Lost")}
                className="rounded-lg bg-red-600 p-3 font-bold hover:bg-red-500"
              >
                Scrum Lost
              </button>

              <button
                onClick={startAttack}
                className="rounded-lg bg-green-600 p-3 font-bold hover:bg-green-500"
              >
                Attack Entry
              </button>

              <button
                onClick={() => addEvent("Ball Lost")}
                className="rounded-lg bg-red-700 p-3 font-bold hover:bg-red-600"
              >
                Ball Lost
              </button>

              <button
                onClick={() => addEvent("Try Scored")}
                className="col-span-2 rounded-lg bg-cyan-400 p-3 font-bold text-slate-950 hover:bg-cyan-300"
              >
                Try Scored
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Event Log</h2>
            <p className="text-sm text-slate-400">
              Click any event to jump to timestamp
            </p>
          </div>

          {events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
              No events tagged yet.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((item) => (
                <button
                  key={item.id}
                  onClick={() => jumpTo(item.seconds)}
                  className="grid w-full grid-cols-3 rounded-lg border border-slate-800 bg-slate-900 p-3 text-left hover:border-cyan-400 hover:bg-slate-800"
                >
                  <span className="font-mono text-cyan-400">{item.time}</span>
                  <span className="font-bold">{item.event}</span>
                  <span className="text-right text-slate-300">{item.zone}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}