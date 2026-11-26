import { Input, Label, ListBox, Select, TextArea, TextField } from '@heroui/react'
import { META_GROUPS } from '../../lib/metadata'

interface Props {
  metadata: Record<string, string>
  onChange: (key: string, value: string) => void
}

/** Metadata que se incrusta en el MP4 al exportar el proyecto. */
export default function ProjectMetaPanel({ metadata, onChange }: Props) {
  const filled = Object.values(metadata).filter((v) => v.trim()).length
  return (
    <div className="flex flex-col gap-6 p-4">
      <p className="rounded-xl bg-white/[0.03] p-3 text-[11px] leading-snug text-white/55">
        Estos datos se escriben en el video al exportar. Windows, VLC, Plex y la mayoría de
        reproductores los muestran.
        {filled > 0 && <span className="text-red-400"> · {filled} campo(s) con valor</span>}
      </p>
      {META_GROUPS.map((g) => (
        <section key={g.id} className="flex flex-col gap-3">
          <span className="section-title flex items-center gap-1.5">
            <g.icon className="size-3.5" />
            {g.label}
          </span>
          <div className="grid grid-cols-2 gap-3">
            {g.fields.map((f) => {
              const value = metadata[f.key] ?? ''
              const label = (
                <Label className="flex items-center gap-1.5">
                  <f.icon className="size-3.5 text-muted" />
                  {f.label}
                </Label>
              )
              const span = f.half ? 'col-span-1' : 'col-span-2'
              if (f.options) {
                return (
                  <Select
                    key={f.key}
                    className={span}
                    value={value || '__none'}
                    onChange={(k) => k != null && onChange(f.key, k === '__none' ? '' : String(k))}
                  >
                    {label}
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {f.options.map((o) => (
                          <ListBox.Item
                            key={o.value || '__none'}
                            id={o.value || '__none'}
                            textValue={o.label}
                          >
                            {o.label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )
              }
              return (
                <TextField
                  key={f.key}
                  className={span}
                  value={value}
                  onChange={(v) => onChange(f.key, v)}
                >
                  {label}
                  {f.multiline ? (
                    <TextArea rows={3} placeholder={f.hint} />
                  ) : (
                    <Input placeholder={f.hint} />
                  )}
                </TextField>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
