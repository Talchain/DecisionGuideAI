const localClass = 'inline-flex min-h-8'

export const buttons = <>
  <button className="min-h-[32px]" />
  <HoverButton className={localClass} />
  <Hover as={'button'} className="h-[30px]" />
  <OkIconButton className={clsx('size-8', { 'sm:min-h-9': roomy })} />
  <Button size="md" />
  <MenuItem className="[min-height:32px]" />
</>
