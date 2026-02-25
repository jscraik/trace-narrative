use serde_json::json;

#[derive(Debug, Clone, PartialEq, Eq)]
struct RpcFrame {
    id: i64,
    method: &'static str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DeliveryMode {
    Ordered,
    OutOfOrder,
    DuplicateFirst,
}

#[derive(Debug, Default)]
struct FakeSidecarHarness {
    frames: Vec<RpcFrame>,
}

impl FakeSidecarHarness {
    fn with_frames(frames: Vec<RpcFrame>) -> Self {
        Self { frames }
    }

    fn deliver(&self, mode: DeliveryMode) -> Vec<serde_json::Value> {
        match mode {
            DeliveryMode::Ordered => self
                .frames
                .iter()
                .map(|frame| json!({ "id": frame.id, "result": { "method": frame.method } }))
                .collect(),
            DeliveryMode::OutOfOrder => self
                .frames
                .iter()
                .rev()
                .map(|frame| json!({ "id": frame.id, "result": { "method": frame.method } }))
                .collect(),
            DeliveryMode::DuplicateFirst => {
                let mut delivered: Vec<serde_json::Value> = self
                    .frames
                    .iter()
                    .map(|frame| json!({ "id": frame.id, "result": { "method": frame.method } }))
                    .collect();
                if let Some(first) = delivered.first().cloned() {
                    delivered.insert(1, first);
                }
                delivered
            }
        }
    }
}

fn default_frames() -> Vec<RpcFrame> {
    vec![
        RpcFrame {
            id: 1,
            method: "initialize",
        },
        RpcFrame {
            id: 2,
            method: "account/read",
        },
        RpcFrame {
            id: 3,
            method: "account/login/start",
        },
    ]
}

fn burst_frames(count: usize) -> Vec<RpcFrame> {
    (0..count)
        .map(|idx| RpcFrame {
            id: idx as i64 + 1,
            method: "item/completed",
        })
        .collect()
}

fn thread_read_frames() -> Vec<RpcFrame> {
    vec![
        RpcFrame {
            id: 21,
            method: "thread/read",
        },
        RpcFrame {
            id: 22,
            method: "thread/read",
        },
    ]
}

#[test]
fn harness_emits_ordered_frames() {
    let harness = FakeSidecarHarness::with_frames(default_frames());
    let delivered = harness.deliver(DeliveryMode::Ordered);
    let ids: Vec<i64> = delivered
        .iter()
        .map(|frame| frame["id"].as_i64().expect("frame id"))
        .collect();
    assert_eq!(ids, vec![1, 2, 3]);
}

#[test]
fn harness_emits_out_of_order_frames() {
    let harness = FakeSidecarHarness::with_frames(default_frames());
    let delivered = harness.deliver(DeliveryMode::OutOfOrder);
    let ids: Vec<i64> = delivered
        .iter()
        .map(|frame| frame["id"].as_i64().expect("frame id"))
        .collect();
    assert_eq!(ids, vec![3, 2, 1]);
}

#[test]
fn harness_emits_duplicate_frames() {
    let harness = FakeSidecarHarness::with_frames(default_frames());
    let delivered = harness.deliver(DeliveryMode::DuplicateFirst);
    let ids: Vec<i64> = delivered
        .iter()
        .map(|frame| frame["id"].as_i64().expect("frame id"))
        .collect();
    assert_eq!(ids, vec![1, 1, 2, 3]);
}

#[test]
fn harness_supports_burst_delivery_without_losing_frames() {
    const BURST_SIZE: usize = 10_000;
    let harness = FakeSidecarHarness::with_frames(burst_frames(BURST_SIZE));
    let delivered = harness.deliver(DeliveryMode::Ordered);
    assert_eq!(delivered.len(), BURST_SIZE);
    assert_eq!(
        delivered.first().and_then(|frame| frame["id"].as_i64()),
        Some(1)
    );
    assert_eq!(
        delivered.last().and_then(|frame| frame["id"].as_i64()),
        Some(BURST_SIZE as i64)
    );
}

#[test]
fn harness_emits_thread_read_frames_for_stale_response_tests() {
    let harness = FakeSidecarHarness::with_frames(thread_read_frames());
    let delivered = harness.deliver(DeliveryMode::OutOfOrder);
    let ids: Vec<i64> = delivered
        .iter()
        .map(|frame| frame["id"].as_i64().expect("frame id"))
        .collect();
    assert_eq!(ids, vec![22, 21]);
    assert!(delivered
        .iter()
        .all(|frame| frame["result"]["method"] == "thread/read"));
}
