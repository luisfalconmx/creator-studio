import { Label, ListBox, Select } from '@heroui/react'

/** Selector simple a partir de un objeto { valor: etiqueta }. */
export function Choice<K extends string>(props: {
  label: string
  value: K
  options: Record<K, string>
  onChange: (k: K) => void
  isDisabled?: boolean
}) {
  return (
    <Select
      className="w-full"
      value={props.value}
      onChange={(k) => k != null && props.onChange(String(k) as K)}
      isDisabled={props.isDisabled}
    >
      <Label>{props.label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {(Object.keys(props.options) as K[]).map((k) => (
            <ListBox.Item key={k} id={k} textValue={props.options[k]}>
              {props.options[k]}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
