//! Background jobs with cancellation for Lumora PDF.
//!
//! A job runs on its own named thread and checks a [`CancelToken`] between steps. Long work such as
//! whole-document search, merging or OCR runs as a job so the UI thread and the engine's render lane
//! are never blocked. Jobs report progress through the callback the caller gives them.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::JoinHandle;

/// Shared flag a job polls to know it should stop.
#[derive(Debug, Clone, Default)]
pub struct CancelToken(Arc<AtomicBool>);

impl CancelToken {
    /// A token that is not cancelled.
    pub fn new() -> Self {
        Self::default()
    }

    /// Asks the job to stop at its next check.
    pub fn cancel(&self) {
        self.0.store(true, Ordering::SeqCst);
    }

    /// True once [`CancelToken::cancel`] was called.
    pub fn is_cancelled(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
}

/// A running job.
#[derive(Debug)]
pub struct JobHandle {
    token: CancelToken,
    thread: Option<JoinHandle<()>>,
}

impl JobHandle {
    /// Asks the job to stop (it finishes its current step first).
    pub fn cancel(&self) {
        self.token.cancel();
    }

    /// The job's cancel token.
    pub fn token(&self) -> &CancelToken {
        &self.token
    }

    /// True when the job's thread has finished.
    pub fn is_finished(&self) -> bool {
        self.thread.as_ref().is_none_or(JoinHandle::is_finished)
    }

    /// Cancels the job and waits for it to stop.
    pub fn cancel_and_wait(mut self) {
        self.token.cancel();
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

/// Errors starting a job.
#[derive(Debug, thiserror::Error)]
pub enum JobError {
    /// The operating system refused to start a thread.
    #[error("could not start background job: {0}")]
    Spawn(String),
}

/// Starts `work` on a new thread named `lumora-job-{name}`. The work receives the job's cancel
/// token and should return soon after it is cancelled.
pub fn spawn<F>(name: &str, work: F) -> Result<JobHandle, JobError>
where
    F: FnOnce(CancelToken) + Send + 'static,
{
    let token = CancelToken::new();
    let job_token = token.clone();
    let thread = std::thread::Builder::new()
        .name(format!("lumora-job-{name}"))
        .spawn(move || work(job_token))
        .map_err(|e| JobError::Spawn(e.to_string()))?;
    Ok(JobHandle {
        token,
        thread: Some(thread),
    })
}

#[cfg(test)]
mod tests {
    use std::sync::mpsc;
    use std::time::Duration;

    use super::*;

    #[test]
    fn runs_and_finishes() {
        let (tx, rx) = mpsc::channel();
        let job = spawn("test", move |_| tx.send(42).unwrap()).unwrap();
        assert_eq!(rx.recv_timeout(Duration::from_secs(5)).unwrap(), 42);
        job.cancel_and_wait();
    }

    #[test]
    fn stops_when_cancelled() {
        let (tx, rx) = mpsc::channel();
        let job = spawn("loop", move |token| {
            let mut steps = 0u64;
            while !token.is_cancelled() {
                steps += 1;
                std::thread::sleep(Duration::from_millis(1));
            }
            tx.send(steps).unwrap();
        })
        .unwrap();
        std::thread::sleep(Duration::from_millis(20));
        job.cancel();
        assert!(rx.recv_timeout(Duration::from_secs(5)).is_ok());
        job.cancel_and_wait();
    }
}
