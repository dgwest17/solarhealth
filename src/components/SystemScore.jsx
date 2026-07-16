import React from 'react';
import { calculateSystemScore } from '../tech/systemScore';
import { Award, TrendingUp, AlertTriangle } from 'lucide-react';

const SystemScore = ({ calculations, inputs }) => {
  const score = calculateSystemScore(calculations, inputs);



  return (
    <div className={`${score.bgColor} border-2 ${score.borderColor} rounded-xl shadow-xl p-8 mb-6`}>
      <div className="flex items-center gap-6 mb-6">
        <div className={`w-32 h-32 rounded-2xl bg-gradient-to-br ${score.color} flex items-center justify-center shadow-2xl ${score.critical ? 'animate-pulse ring-4 ring-red-500/70' : ''}`}>
          <div className="text-center">
            <div className="text-7xl font-black text-white">{score.grade}</div>
          </div>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-5xl">{score.icon}</span>
            <h2 className={`text-4xl font-bold ${score.textColor}`}>
              System Score: {score.label}
            </h2>
          </div>
          
          <div className={`mt-4 p-4 bg-white rounded-lg border ${score.borderColor} shadow-sm`}>
            <h3 className="font-semibold text-gray-800 mb-2 text-lg">💡 Recommendation:</h3>
            <p className="text-gray-700 leading-relaxed">
              {score.recommendation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemScore;
