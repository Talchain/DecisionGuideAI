/* ------------------------------------------------------------------ */
/*  DecisionEdit.tsx – Loader + Inner pattern                          */
/* ------------------------------------------------------------------ */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  useNavigate,
  useParams,
  Navigate
} from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  Users,
  Loader2
} from 'lucide-react';

import BiasesCarousel from '../../components/BiasesCarousel';
import ProsConsList from '../../components/ProsConsList';
import { useAnalysis } from '../../hooks/useAnalysis';
import { analyzeOptions } from '../../lib/api';
import AnalysisContent from '../../components/Analysis/AnalysisContent';

import { supabase, saveDecisionAnalysis, createDecision } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Bias } from '../../lib/api';

/* ---------- shared types ---------- */
interface DecisionRow {
  id: string;
  title: string;
  type: string;
  reversibility: string;
  importance: string;
  description: string | null;
  goals: string[] | null;
}

/* ================================================================== */
/*  1. Loader component – fetch row, show spinner / error              */
/* ================================================================== */
function DecisionEditLoader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return <Navigate to="/decisions" replace />;

  const [row, setRow] = useState<DecisionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('decisions')
        .select('id, title, type, reversibility, importance, description, goals')
        .eq('id', id)
        .single();
      if (cancelled) return;
      if (error) setErr(error.message);
      else setRow(data as DecisionRow);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-600">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        Loading decision…
      </div>
    );

  if (err || !row)
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <p className="text-red-600 mb-2">
          {err || 'Decision not found.'}
        </p>
        <button
          className="text-indigo-600 underline"
          onClick={() => navigate('/decisions')}
        >
          Back to list
        </button>
      </div>
    );

  return <DecisionEditInner row={row} />;
}

/* ================================================================== */
/*  2. Inner component – ALWAYS same hooks order                       */
/* ================================================================== */
interface InnerProps {
  row: DecisionRow;
}

function DecisionEditInner({ row }: InnerProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  /* ------------- local shorthand vars ------------- */
  const {
    id: decisionId,
    title,
    type,
    reversibility,
    importance,
    goals = []
  } = row;

  /* ------------- analysis hook (stable) ----------- */
  const {
    aiAnalysis,
    options,
    loading: analysisLoading,
    error: analysisError,
    retryCount,
    retry
  } = useAnalysis({
    decision: title,
    decisionType: type,
    reversibility,
    importance,
    goals
  });

  /* ------------- bias & options fetch ------------- */
  const [biases, setBiases] = useState<Bias[]>([]);
  const [optLoad, setOptLoad] = useState(false);
  const [optErr, setOptErr] = useState<string | null>(null);

  const fetchBiases = useCallback(async () => {
    setOptLoad(true);
    setOptErr(null);
    try {
      const res = await analyzeOptions({
        decision: title,
        decisionType: type,
        reversibility,
        importance,
        goals
      });
      setBiases(Array.isArray(res.biases) ? res.biases : []);
    } catch (e) {
      setOptErr(e instanceof Error ? e.message : 'Bias fetch failed');
    } finally {
      setOptLoad(false);
    }
  }, [title, type, reversibility, importance, goals]);

  /* fetch biases once after mount */
  useEffect(() => {
    fetchBiases();
  }, [fetchBiases]);

  /* ------------ simple back handler --------------- */
  const handleBack = () => navigate('/decisions');

  /* ----------------- render UI -------------------- */
  return (
    <div className="flex flex-col min-h-0 h-full overflow-hidden">
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors p-2 rounded border"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-xl shadow-lg p-6 overflow-y-auto space-y-6">

        {/* Bias carousel */}
        <BiasesCarousel biases={biases}
                        isLoading={optLoad}
                        error={optErr} />

        {/* AI analysis */}
        {analysisLoading ? (
          <div className="flex items-center justify-center p-8 text-gray-500">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            Generating analysis…
          </div>
        ) : analysisError ? (
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-red-700 font-medium">
                Error loading AI analysis
              </p>
            </div>
            <p className="text-red-600 text-sm pl-7">{analysisError}</p>
            {retryCount < 3 && (
              <button
                onClick={retry}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium pl-7"
              >
                Try Again
              </button>
            )}
          </div>
        ) : aiAnalysis ? (
          <AnalysisContent text={aiAnalysis} />
        ) : (
          <p className="text-gray-500 italic">No analysis generated.</p>
        )}

        {/* Options */}
        {!analysisLoading &&
          !analysisError &&
          options?.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-lg font-semibold mb-4">Options Analysis</h3>
              <ProsConsList
                decision={title}
                initialOptions={options}
                biases={biases}
              />
            </div>
          )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  3. Export Loader as default                                        */
/* ================================================================== */
export default DecisionEditLoader;