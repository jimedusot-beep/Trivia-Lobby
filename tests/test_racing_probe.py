import importlib.util
import contextlib
import io
import asyncio
import json
import pathlib
import unittest

SPEC = importlib.util.spec_from_file_location("racing_probe", pathlib.Path(__file__).parents[1] / "script/measure-racing.py")
probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(probe)


class RacingMetricsTests(unittest.TestCase):
    def test_echo_latency_uses_the_observed_sequence_and_counts_superseded_inputs(self):
        metrics = probe.RacingMetrics()
        metrics.sent(0, 1.000)
        metrics.sent(1, 1.050)
        metrics.sent(2, 1.100)
        metrics.frame(1.180, 2)
        metrics.frame(1.480, 2)
        result = metrics.summary()
        self.assertEqual(result["inputEchoMs"], {"count": 1, "p50": 80.0, "p95": 80.0, "max": 80.0})
        self.assertEqual(result["batchWaitMs"]["max"], 180.0)
        self.assertEqual(result["supersededInputs"], 2)
        self.assertEqual(result["frameGapMs"]["max"], 300.0)
        self.assertEqual(result["pendingInputs"], 0)

    def test_missing_frames_are_visible_and_pending_inputs_remain_bounded(self):
        metrics = probe.RacingMetrics()
        for seq in range(300):
            metrics.sent(seq, seq / 20)
        result = metrics.summary()
        self.assertEqual(result["frames"], 0)
        self.assertEqual(result["inputEchoMs"]["count"], 0)
        self.assertEqual(result["pendingInputs"], 256)
        self.assertEqual(result["unobservedInputs"], 44)
        self.assertIsNone(result["frameGapMs"]["p95"])

    def test_percentile_uses_hand_checked_nearest_rank(self):
        self.assertEqual(probe.distribution([10, 20, 30, 40, 100])["p95"], 100)
        self.assertEqual(probe.distribution([10, 20, 30, 40, 100])["p50"], 30)

    def test_probe_error_categories_do_not_include_server_payloads(self):
        peer = probe.Peer()
        peer.note_error("Unknown action.")
        peer.note_error("These controls belong to an old race.")
        peer.note_error("PRIVATE_TOKEN postgres://secret/db")
        self.assertEqual(peer.server_errors, {"unknown_action": 1, "stale_race_input": 1, "other": 1})
        self.assertEqual(peer.errors, 3)

    def test_live_probe_rejects_unbounded_runs(self):
        for arguments in [["--players", "21"], ["--players", "1"], ["--seconds", "61"], ["--seconds", "0"], ["--hz", "41"]]:
            with self.assertRaises(SystemExit), contextlib.redirect_stderr(io.StringIO()):
                probe.parse_args(arguments)
        args = probe.parse_args(["--players", "20", "--seconds", "60", "--hz", "20"])
        self.assertEqual((args.players, args.seconds, args.hz), (20, 60, 20))


class RacingShutdownTests(unittest.IsolatedAsyncioTestCase):
    async def test_error_delivered_during_shutdown_prevents_success(self):
        class ClosingSocket:
            def __init__(self):
                self.queue = asyncio.Queue()
            def __aiter__(self):
                return self
            async def __anext__(self):
                value = await self.queue.get()
                if value is None:
                    raise StopAsyncIteration
                return value
            async def close(self):
                await self.queue.put(json.dumps({"type": "error", "message": "Unknown action."}))
                await self.queue.put(None)
        peer = probe.Peer()
        peer.ws = ClosingSocket()
        peer.task = asyncio.create_task(peer.read())
        peer.metrics.frame(1.0)
        result = {"complete": True}
        await probe.finish_result([peer], result)
        self.assertFalse(result["complete"])
        self.assertEqual(result["errors"], 1)
        self.assertEqual(result["unexpectedDisconnects"], 0)


if __name__ == "__main__":
    unittest.main()
