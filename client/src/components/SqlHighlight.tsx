import { useMemo } from 'react';

// ── Firebird SQL Token Types ────────────────────────────────────

type TokenType =
  | 'keyword'
  | 'type'
  | 'function'
  | 'number'
  | 'string'
  | 'comment'
  | 'operator'
  | 'identifier'
  | 'quoted-identifier'
  | 'parameter'
  | 'punctuation'
  | 'constant'
  | 'whitespace';

interface Token {
  type: TokenType;
  value: string;
}

// ── Keyword / Type / Function Sets ──────────────────────────────

const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'IS', 'AS', 'ON',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'NATURAL',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'CREATE', 'ALTER', 'DROP', 'TABLE', 'VIEW', 'INDEX', 'TRIGGER', 'PROCEDURE',
  'FUNCTION', 'SEQUENCE', 'GENERATOR', 'DOMAIN', 'EXCEPTION', 'ROLE', 'PACKAGE',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK', 'CONSTRAINT',
  'DEFAULT', 'CASCADE', 'RESTRICT', 'NO', 'ACTION',
  'ORDER', 'BY', 'ASC', 'DESC', 'GROUP', 'HAVING', 'LIMIT',
  'DISTINCT', 'ALL', 'ANY', 'SOME', 'EXISTS',
  'UNION', 'INTERSECT', 'EXCEPT', 'MINUS',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'BETWEEN', 'LIKE', 'ESCAPE', 'SIMILAR', 'STARTING', 'CONTAINING', 'WITH',
  'GRANT', 'REVOKE', 'EXECUTE', 'USAGE', 'TO',
  'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE',
  'BEGIN', 'DECLARE', 'VARIABLE', 'CURSOR', 'FOR', 'DO', 'WHILE', 'IF',
  'LEAVE', 'BREAK', 'RETURN', 'RETURNS', 'SUSPEND', 'EXIT',
  'COLLATE', 'CHARACTER',
  'FIRST', 'SKIP', 'ROWS', 'ROW', 'PERCENT', 'TIES', 'OFFSET', 'FETCH', 'NEXT', 'ONLY',
  'PLAN', 'MERGE', 'HASH', 'SORT',
  'RECREATE', 'ACTIVE', 'INACTIVE', 'BEFORE', 'AFTER', 'POSITION', 'TYPE',
  'COMPUTED', 'GENERATED', 'ALWAYS', 'IDENTITY', 'RESTART', 'INCREMENT',
  'EXTERNAL', 'ENGINE', 'NAME', 'AUTONOMOUS', 'TRANSACTION',
  'POST_EVENT', 'EVENT', 'INIT', 'CONNECT', 'DISCONNECT', 'DATABASE',
  'TERM', 'TERMINATOR', 'COMMENT', 'DESCRIPTION',
  'BLOCK', 'STATEMENT', 'OVER', 'PARTITION', 'WINDOW', 'RANGE',
  'UNBOUNDED', 'PRECEDING', 'FOLLOWING', 'CURRENT',
  'FILTER', 'LATERAL', 'RECURSIVE', 'BODY',
  'MAPPING', 'GLOBAL', 'LOCAL', 'TEMPORARY', 'PRESERVE',
  'SNAPSHOT', 'WAIT', 'LOCK', 'TIMEOUT',
  'READ', 'WRITE', 'COMMITTED', 'UNCOMMITTED', 'ISOLATION', 'LEVEL', 'RETAIN',
  'USING', 'MATCHING', 'UPDATING', 'INSERTING', 'DELETING',
  'OLD', 'NEW', 'OF', 'ADDING',
  'SUB_TYPE', 'SEGMENT', 'SIZE',
  'NOT', 'ADD', 'COLUMN',
]);

const TYPES = new Set([
  'SMALLINT', 'INTEGER', 'INT', 'BIGINT', 'INT128',
  'FLOAT', 'DOUBLE', 'PRECISION', 'REAL', 'NUMERIC', 'DECIMAL', 'DECFLOAT',
  'DATE', 'TIME', 'TIMESTAMP', 'ZONE',
  'CHAR', 'VARCHAR', 'NCHAR', 'NVARCHAR', 'VARYING',
  'BLOB', 'BOOLEAN', 'ARRAY', 'VARBINARY', 'TEXT', 'BINARY',
]);

const FUNCTIONS = new Set([
  'ABS', 'ACOS', 'ACOSH', 'ASCII_CHAR', 'ASCII_VAL', 'ASIN', 'ASINH',
  'ATAN', 'ATAN2', 'ATANH', 'AVG',
  'BIN_AND', 'BIN_NOT', 'BIN_OR', 'BIN_SHL', 'BIN_SHR', 'BIN_XOR',
  'BIT_LENGTH', 'CAST', 'CEIL', 'CEILING', 'CHAR_LENGTH', 'CHAR_TO_UUID',
  'CHARACTER_LENGTH', 'COALESCE', 'COS', 'COSH', 'COT', 'COUNT',
  'DATEADD', 'DATEDIFF', 'DECODE',
  'EXP', 'EXTRACT', 'FLOOR',
  'GEN_ID', 'GEN_UUID',
  'HASH', 'IIF',
  'LEFT', 'LN', 'LOG', 'LOG10', 'LOWER', 'LPAD', 'LTRIM', 'LIST',
  'MAX', 'MAXVALUE', 'MIN', 'MINVALUE', 'MOD',
  'NULLIF', 'OCTET_LENGTH', 'OVERLAY',
  'PI', 'POWER',
  'RAND', 'REPLACE', 'REVERSE', 'RIGHT', 'ROUND', 'RPAD', 'RTRIM',
  'SIGN', 'SIN', 'SINH', 'SQRT', 'SUBSTRING', 'SUM',
  'TAN', 'TANH', 'TRIM', 'TRUNC', 'UPPER', 'UUID_TO_CHAR',
  'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'PERCENT_RANK', 'CUME_DIST',
  'NTILE', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE', 'NTH_VALUE',
  'STDDEV_POP', 'STDDEV_SAMP', 'VAR_POP', 'VAR_SAMP',
  'CORR', 'COVAR_POP', 'COVAR_SAMP',
]);

const CONSTANTS = new Set([
  'NULL', 'TRUE', 'FALSE',
  'CURRENT_USER', 'CURRENT_ROLE', 'CURRENT_CONNECTION', 'CURRENT_TRANSACTION',
  'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
  'NOW', 'TODAY', 'TOMORROW', 'YESTERDAY',
  'ROW_COUNT', 'GDSCODE', 'SQLCODE', 'SQLSTATE',
  'RDB$DB_KEY',
]);

// ── Tokenizer ───────────────────────────────────────────────────

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < sql.length) {
    // Whitespace
    if (/\s/.test(sql[i])) {
      let j = i;
      while (j < sql.length && /\s/.test(sql[j])) j++;
      tokens.push({ type: 'whitespace', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Line comment --
    if (sql[i] === '-' && sql[i + 1] === '-') {
      let j = i;
      while (j < sql.length && sql[j] !== '\n') j++;
      tokens.push({ type: 'comment', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Block comment /* */
    if (sql[i] === '/' && sql[i + 1] === '*') {
      let j = i + 2;
      while (j < sql.length - 1 && !(sql[j] === '*' && sql[j + 1] === '/')) j++;
      j += 2;
      tokens.push({ type: 'comment', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // String 'text'
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j++; break; }
        j++;
      }
      tokens.push({ type: 'string', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Quoted identifier "name"
    if (sql[i] === '"') {
      let j = i + 1;
      while (j < sql.length && sql[j] !== '"') j++;
      j++;
      tokens.push({ type: 'quoted-identifier', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Parameter :name or ?
    if (sql[i] === ':' && /[a-zA-Z_]/.test(sql[i + 1] ?? '')) {
      let j = i + 1;
      while (j < sql.length && /[a-zA-Z0-9_$]/.test(sql[j])) j++;
      tokens.push({ type: 'parameter', value: sql.slice(i, j) });
      i = j;
      continue;
    }
    if (sql[i] === '?') {
      tokens.push({ type: 'parameter', value: '?' });
      i++;
      continue;
    }

    // Number
    if (/[0-9]/.test(sql[i]) || (sql[i] === '.' && /[0-9]/.test(sql[i + 1] ?? ''))) {
      let j = i;
      if (sql[j] === '0' && (sql[j + 1] === 'x' || sql[j + 1] === 'X')) {
        j += 2;
        while (j < sql.length && /[0-9a-fA-F]/.test(sql[j])) j++;
      } else {
        while (j < sql.length && /[0-9]/.test(sql[j])) j++;
        if (sql[j] === '.' && /[0-9]/.test(sql[j + 1] ?? '')) {
          j++;
          while (j < sql.length && /[0-9]/.test(sql[j])) j++;
        }
        if ((sql[j] === 'e' || sql[j] === 'E') && /[0-9+-]/.test(sql[j + 1] ?? '')) {
          j++;
          if (sql[j] === '+' || sql[j] === '-') j++;
          while (j < sql.length && /[0-9]/.test(sql[j])) j++;
        }
      }
      tokens.push({ type: 'number', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Word (keyword, type, function, identifier)
    if (/[a-zA-Z_$]/.test(sql[i])) {
      let j = i;
      while (j < sql.length && /[a-zA-Z0-9_$]/.test(sql[j])) j++;
      // Handle RDB$xxx, MON$xxx, SEC$xxx
      if (sql[j] === '$') {
        while (j < sql.length && /[a-zA-Z0-9_$]/.test(sql[j])) j++;
      }
      const word = sql.slice(i, j);
      const upper = word.toUpperCase();

      if (CONSTANTS.has(upper)) {
        tokens.push({ type: 'constant', value: word });
      } else if (TYPES.has(upper)) {
        tokens.push({ type: 'type', value: word });
      } else if (FUNCTIONS.has(upper)) {
        tokens.push({ type: 'function', value: word });
      } else if (KEYWORDS.has(upper)) {
        tokens.push({ type: 'keyword', value: word });
      } else {
        tokens.push({ type: 'identifier', value: word });
      }
      i = j;
      continue;
    }

    // Operators
    if ('<>=!|&~^+-*/%'.includes(sql[i])) {
      let j = i;
      // Multi-char operators: <=, >=, <>, !=, ||, <<, >>
      if (j + 1 < sql.length && '<>=!|'.includes(sql[j]) && '<>=|'.includes(sql[j + 1])) j += 2;
      else j++;
      tokens.push({ type: 'operator', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Punctuation (, ; . ( ))
    if ('(),;.'.includes(sql[i])) {
      tokens.push({ type: 'punctuation', value: sql[i] });
      i++;
      continue;
    }

    // Fallback: single char
    tokens.push({ type: 'identifier', value: sql[i] });
    i++;
  }

  return tokens;
}

// ── Color Maps ──────────────────────────────────────────────────

const DARK_COLORS: Record<TokenType, string> = {
  keyword: '#cc7832',
  type: '#b389d9',
  function: '#ffc66d',
  number: '#6897bb',
  string: '#6a8759',
  comment: '#808080',
  operator: '#a9b7c6',
  identifier: '#a9b7c6',
  'quoted-identifier': '#e8bf6a',
  parameter: '#9876aa',
  punctuation: '#a9b7c6',
  constant: '#cc7832',
  whitespace: '',
};

const LIGHT_COLORS: Record<TokenType, string> = {
  keyword: '#0033b3',
  type: '#7a3e9d',
  function: '#00627a',
  number: '#1750eb',
  string: '#067d17',
  comment: '#8c8c8c',
  operator: '#2b2b2b',
  identifier: '#2b2b2b',
  'quoted-identifier': '#9e880d',
  parameter: '#660e7a',
  punctuation: '#2b2b2b',
  constant: '#0033b3',
  whitespace: '',
};

const DARK_WEIGHTS: Partial<Record<TokenType, string>> = {
  keyword: '500',
  constant: '700',
};

const LIGHT_WEIGHTS: Partial<Record<TokenType, string>> = {
  keyword: '600',
  constant: '700',
};

const DARK_STYLES: Partial<Record<TokenType, string>> = {
  comment: 'italic',
};

const LIGHT_STYLES: Partial<Record<TokenType, string>> = {
  comment: 'italic',
};

// ── Component ───────────────────────────────────────────────────

interface SqlHighlightProps {
  code: string | null;
}

export function SqlHighlight({ code }: SqlHighlightProps) {
  const isDark = document.documentElement.classList.contains('dark');
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
  const weights = isDark ? DARK_WEIGHTS : LIGHT_WEIGHTS;
  const styles = isDark ? DARK_STYLES : LIGHT_STYLES;

  const highlighted = useMemo(() => {
    if (!code) return null;
    const tokens = tokenize(code);
    return tokens.map((token, i) => {
      if (token.type === 'whitespace') return <span key={i}>{token.value}</span>;
      return (
        <span
          key={i}
          style={{
            color: colors[token.type],
            fontWeight: weights[token.type],
            fontStyle: styles[token.type],
          }}
        >
          {token.value}
        </span>
      );
    });
  }, [code, colors, weights, styles]);

  if (!code) return <span className="text-text-tertiary italic text-sm">No source available</span>;

  return (
    <pre className="p-4 bg-code-bg border border-border rounded-xl text-[13px] font-mono leading-relaxed overflow-auto whitespace-pre-wrap">
      <code>{highlighted}</code>
    </pre>
  );
}
