import { SQLDialect } from '@codemirror/lang-sql';

const keywords = `
  select from where and or not in is as on join left right inner outer full cross natural
  insert into values update set delete create alter drop table view index trigger procedure
  function sequence generator domain exception role package
  primary key foreign references unique check constraint default cascade restrict
  order by asc desc group having distinct all any some exists
  union intersect except case when then else end
  between like escape similar starting containing with
  grant revoke execute usage to commit rollback savepoint release
  begin declare variable cursor for do while if leave break return returns suspend exit
  collate character first skip rows row offset fetch next only
  plan merge recreate active inactive before after position type
  computed generated always identity restart increment
  external engine name autonomous transaction
  post_event connect disconnect database block statement
  over partition window range unbounded preceding following current
  filter lateral recursive body mapping global local temporary preserve
  using matching updating inserting deleting old new of add column
  no action read write committed uncommitted isolation level retain
  sub_type segment size
`.trim();

const types = `
  smallint integer int bigint int128 float double precision real
  numeric decimal decfloat date time timestamp char varchar
  nchar nvarchar blob boolean array varbinary text binary
`.trim();

const builtin = `
  abs acos acosh ascii_char ascii_val asin asinh atan atan2 atanh avg
  bin_and bin_not bin_or bin_shl bin_shr bin_xor bit_length
  cast ceil ceiling char_length char_to_uuid character_length
  coalesce cos cosh cot count dateadd datediff decode
  exp extract floor gen_id gen_uuid hash iif
  left ln log log10 lower lpad ltrim list max maxvalue min minvalue mod
  nullif octet_length overlay pi position power
  rand replace reverse right round rpad rtrim
  sign sin sinh sqrt substring sum tan tanh trim trunc upper uuid_to_char
  row_number rank dense_rank percent_rank cume_dist
  ntile lag lead first_value last_value nth_value
  stddev_pop stddev_samp var_pop var_samp corr covar_pop covar_samp
  null true false current_user current_role current_connection current_transaction
  current_date current_time current_timestamp now today tomorrow yesterday
  row_count gdscode sqlcode sqlstate
`.trim();

export const FirebirdSQL = SQLDialect.define({
  keywords,
  types,
  builtin,
  hashComments: false,
  slashComments: true,
  backslashEscapes: false,
  identifierQuotes: '"',
  operatorChars: '+-*/<>=~!@#%^&|`?',
  specialVar: ':',
});
