import { useState } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useFlags } from '@/lib/flags';

const steps: Step[] = [
  {
    target: '[data-coach="save-snapshot"]',
    content: 'Save your work by creating a snapshot!',
  },
  {
    target: '[data-coach="add-node"]',
    content: 'Add a new node to your scenario.',
  },
  {
    target: '[data-coach="draw-edge"]',
    content: 'Draw a connection between nodes.',
  },
  {
    target: '[data-coach="commit-scenario"]',
    content: 'Commit your scenario to run the solver.',
  },
  {
    target: '[data-coach="view-diff"]',
    content: 'See what changed since your last commit using the diff view.',
  },
];

export function OnboardingCoach() {
  const flags = useFlags()
  if (!flags.sandbox) return null;
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  return (
    <>
      <button
        className="fixed bottom-4 left-4 bg-blue-600 text-white px-3 py-1 rounded shadow z-50"
        onClick={() => setRun(true)}
      >
        Show Guide
      </button>
      <Joyride
        steps={steps}
        run={run}
        stepIndex={stepIndex}
        showSkipButton
        showProgress
        continuous
        disableScrolling
        styles={{ options: { zIndex: 10000 } }}
        callback={(data: CallBackProps) => {
          if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
            setRun(false);
            setStepIndex(0);
          } else if (data.action === 'next' || data.action === 'prev') {
            setStepIndex(data.index + (data.action === 'next' ? 1 : -1));
          }
        }}
      />
    </>
  );
}
