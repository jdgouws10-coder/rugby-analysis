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
    <main className="min-h-screen bg-green-900 text-white p-8">
      <h1 className="text-5xl font-bold mb-6">Rugby Analysis Platform</h1>

      <div className="bg-slate-800 rounded-lg p-4 mb-6">
        <h2 className="text-2xl mb-4">Match Details</h2>

        <div className="grid grid-cols-3 gap-4">
          <input
            className="bg-white text-black p-3 rounded"
            placeholder="Your Team"
            value={matchName}
            onChange={(e) => setMatchName(e.target.value)}
          />

          <input
            className="bg-white text-black p-3 rounded"
            placeholder="Opposition"
            value={opposition}
            onChange={(e) => setOpposition(e.target.value)}
          />

          <input
            className="bg-white text-black p-3 rounded"
            placeholder="Competition"
            value={competition}
            onChange={(e) => setCompetition(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-slate-300">Total Attacks</p>
          <p className="text-4xl font-bold">{totalAttacks}</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-slate-300">Tries</p>
          <p className="text-4xl font-bold">{tries}</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-slate-300">Ball Losses</p>
          <p className="text-4xl font-bold">{ballLosses}</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-slate-300">Lineouts</p>
          <p className="text-3xl font-bold">
            {lineoutsWon}W / {lineoutsLost}L
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-slate-300">Scrums</p>
          <p className="text-3xl font-bold">
            {scrumsWon}W / {scrumsLost}L
          </p>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={exportToTXT}
          className="bg-yellow-500 text-black font-bold p-3 rounded"
        >
          Export TXT Report
        </button>

        <button
          onClick={saveMatch}
          className="bg-blue-600 text-white font-bold p-3 rounded"
        >
          Save Match
        </button>

        <button
          onClick={clearMatch}
          className="bg-red-600 text-white font-bold p-3 rounded"
        >
          Clear Match
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-black rounded-lg p-4">
          <input
            className="w-full bg-white text-black p-3 rounded mb-4"
            placeholder="Paste YouTube match link here"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
          />

          {videoId ? (
            <YouTube
              videoId={videoId}
              opts={{
                width: "100%",
                height: "360",
                playerVars: {
                  controls: 1,
                },
              }}
              onReady={(event) => setPlayer(event.target)}
            />
          ) : (
            <div className="h-96 flex items-center justify-center text-slate-400 border border-slate-700 rounded">
              Paste a YouTube match link above to load video
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-2xl mb-4">Field Zone</h2>

          <div className="grid grid-cols-5 gap-2 mb-6">
            {zones.map((zone) => (
              <button
                key={zone}
                onClick={() => setSelectedZone(zone)}
                className={`p-3 rounded ${
                  selectedZone === zone
                    ? "bg-yellow-500 text-black"
                    : "bg-slate-600"
                }`}
              >
                {zone}
              </button>
            ))}
          </div>

          <div className="bg-slate-700 rounded-lg p-4 mb-6">
            <h2 className="text-xl font-bold mb-2">Current Attack</h2>

            {attackActive ? (
              <>
                <p>Start Zone: {attackStartZone}</p>
                <p>Phases: {phaseCount}</p>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={addPhase}
                    className="bg-blue-500 p-2 rounded"
                  >
                    + Phase
                  </button>

                  <button
                    onClick={() => finishAttack("Try")}
                    className="bg-yellow-500 text-black p-2 rounded"
                  >
                    Try
                  </button>

                  <button
                    onClick={() => finishAttack("Ball Lost")}
                    className="bg-red-600 p-2 rounded"
                  >
                    Ball Lost
                  </button>

                  <button
                    onClick={() => finishAttack("Penalty Won")}
                    className="bg-green-600 p-2 rounded"
                  >
                    Penalty Won
                  </button>

                  <button
                    onClick={() => finishAttack("Kick")}
                    className="bg-slate-500 p-2 rounded"
                  >
                    Kick
                  </button>
                </div>
              </>
            ) : (
              <p>No active attack</p>
            )}
          </div>

          <h2 className="text-2xl mb-4">Attack Coach Events</h2>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => addEvent("Lineout Won")}
              className="bg-blue-600 p-3 rounded"
            >
              Lineout Won
            </button>

            <button
              onClick={() => addEvent("Lineout Lost")}
              className="bg-red-600 p-3 rounded"
            >
              Lineout Lost
            </button>

            <button
              onClick={() => addEvent("Scrum Won")}
              className="bg-blue-600 p-3 rounded"
            >
              Scrum Won
            </button>

            <button
              onClick={() => addEvent("Scrum Lost")}
              className="bg-red-600 p-3 rounded"
            >
              Scrum Lost
            </button>

            <button
              onClick={startAttack}
              className="bg-green-600 p-3 rounded"
            >
              Attack Entry
            </button>

            <button
              onClick={() => addEvent("Ball Lost")}
              className="bg-red-700 p-3 rounded"
            >
              Ball Lost
            </button>

            <button
              onClick={() => addEvent("Try Scored")}
              className="bg-yellow-500 text-black p-3 rounded"
            >
              Try Scored
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 mt-6">
        <h2 className="text-2xl mb-4">Event Log</h2>

        {events.length === 0 ? (
          <p className="text-slate-300">No events tagged yet.</p>
        ) : (
          <div className="space-y-2">
            {events.map((item) => (
              <button
                key={item.id}
                onClick={() => jumpTo(item.seconds)}
                className="w-full bg-slate-700 p-3 rounded flex justify-between hover:bg-slate-600"
              >
                <span>{item.time}</span>
                <span>{item.event}</span>
                <span>{item.zone}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}