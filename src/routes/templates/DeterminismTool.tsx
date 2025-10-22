/**
 * Determinism Verification Tool
 * Runs same template+seed 5× and verifies identical response_hash
 */
import { useState } from 'react'
import { runTemplate, type RunRequest } from '../../lib/plotApi'
import { Check, X, Loader2 } from 'lucide-react'

interface DeterminismToolProps {
  request: RunRequest
  token: string
}

export function DeterminismTool({ request, token }: DeterminismToolProps) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ passed: boolean; hashes: string[]; proof: string } | null>(null)

  const handleVerify = async () => {
    setRunning(true)
    setResult(null)
    
    try {
      const hashes: string[] = []
      
      for (let i = 0; i < 5; i++) {
        const response = await runTemplate(request, token)
        hashes.push(response.model_card.response_hash)
      }
      
      const uniqueHashes = new Set(hashes)
      const passed = uniqueHashes.size === 1
      
      const proof = `Determinism Proof
Template: ${request.template_id}
Seed: ${request.seed}
Belief Mode: ${request.belief_mode || 'as_provided'}
Runs: 5
Unique Hashes: ${uniqueHashes.size}
Hash: ${hashes[0]}
Status: ${passed ? 'PASS ✓' : 'FAIL ✗'}
Timestamp: ${new Date().toISOString()}`
      
      setResult({ passed, hashes, proof })
    } catch (err) {
      console.error('[DeterminismTool] Verification failed:', err)
    } finally {
      setRunning(false)
    }
  }

  const handleCopyProof = () => {
    if (result) {
      navigator.clipboard.writeText(result.proof)
    }
  }

  return (
    <div className="border rounded p-4 mt-4" data-testid="determinism-tool">
      <h3 className="text-sm font-semibold mb-2">Determinism Verification</h3>
      <p className="text-xs text-gray-600 mb-3">
        Run this template 5 times with the same seed to verify identical results.
      </p>
      
      <button
        onClick={handleVerify}
        disabled={running}
        className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
        aria-label="Verify determinism"
      >
        {running ? (
          <>
            <Loader2 className="inline h-4 w-4 mr-1 animate-spin" />
            Running 5×...
          </>
        ) : (
          'Verify Determinism'
        )}
      </button>
      
      {result && (
        <div className={`mt-3 p-3 rounded ${result.passed ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'}`}>
          <div className="flex items-center gap-2 mb-2">
            {result.passed ? (
              <>
                <Check className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-800">Determinism Verified ✓</span>
              </>
            ) : (
              <>
                <X className="h-5 w-5 text-red-600" />
                <span className="font-semibold text-red-800">Determinism Failed ✗</span>
              </>
            )}
          </div>
          
          <div className="text-xs text-gray-700 mb-2">
            <div>Runs: 5</div>
            <div>Unique hashes: {new Set(result.hashes).size}</div>
            <div className="font-mono text-xs break-all">Hash: {result.hashes[0].slice(0, 32)}...</div>
          </div>
          
          <button
            onClick={handleCopyProof}
            className="text-xs text-blue-600 hover:underline"
            aria-label="Copy proof"
          >
            Copy Proof
          </button>
        </div>
      )}
    </div>
  )
}
