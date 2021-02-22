/* eslint-disable no-new-func */
import Vue from 'vue'
import { transform } from 'esbuild-wasm'
import { adaptCreateElement, concatenate } from 'vue-inbrowser-compiler-utils'
import { shallowMount, mount } from '@vue/test-utils'

describe('integration', () => {
	describe('from JSX', () => {
		const getComponent = async (
			code: string,
			params: { [key: string]: any } = {}
		): Promise<{ [key: string]: any }> => {
			const compiledCode = (
				await transform('const ___ = ' + code, {
					jsxFactory: '__pragma__(h)'
				})
			).code
			const [param1, param2, param3, param4] = Object.keys(params)
			const getValue = new Function(
				'__pragma__',
				'concatenate',
				param1,
				param2,
				param3,
				param4,
				compiledCode + ';return ___;'
			)
			return getValue(
				adaptCreateElement,
				concatenate,
				params[param1],
				params[param2],
				params[param3],
				params[param4]
			)
		}

		test('Contains text', async () => {
			const c = await getComponent(`{
				render(h) {
				  return <div>test</div>
				},
			  }`)
			const wrapper = shallowMount(c)

			expect(wrapper.element.tagName).toBe('DIV')
			expect(wrapper.text()).toBe('test')
		})

		test('Binds text', async () => {
			const text = 'foo'
			const c = await getComponent(
				`{
				render(h) {
					return <div>{text}</div>
				}
			}`,
				{ text }
			)
			const wrapper = shallowMount(c)

			expect(wrapper.element.tagName).toBe('DIV')
			expect(wrapper.text()).toBe('foo')
		})

		test('Extracts attrs', async () => {
			const wrapper = shallowMount(
				await getComponent(`{
					render(h) {
					  return <div id="hi" dir="ltr" />
					},
				  }`)
			)

			expect(wrapper.element.id).toBe('hi')
			expect(wrapper.element.dir).toBe('ltr')
		})

		test('Binds attrs', async () => {
			const hi = 'foo'
			const wrapper = shallowMount(
				await getComponent(
					`{
					render(h) {
					  return <div id={hi} />
					},
				  }`,
					{ hi }
				)
			)

			expect(wrapper.element.id).toBe('foo')
		})

		test('Omits attrs if possible', async () => {
			const wrapper: any = shallowMount(
				await getComponent(`{
					render(h) {
					  return <div>test</div>
					},
				  }`)
			)

			expect(wrapper.vnode.data).toBeUndefined()
		})

		test('Omits children if possible', async () => {
			const wrapper: any = shallowMount(
				await getComponent(`{
				render(h) {
				  return <div/>
				}
			  }`)
			)

			expect(wrapper.vnode.children).toBeUndefined()
		})

		test('Handles top-level special attrs', async () => {
			const wrapper: any = shallowMount(
				await getComponent(`{
					render(h) {
						return <div class="foo" style="bar" key="key" ref="ref" refInFor slot="slot" />
					}
				  }`)
			)
			expect(wrapper.vnode.data.class).toBe('foo')
			expect(wrapper.vnode.data.style).toBe('bar')
			expect(wrapper.vnode.data.key).toBe('key')
			expect(wrapper.vnode.data.ref).toBe('ref')
			expect(wrapper.vnode.data.refInFor).toBeTruthy()
			expect(wrapper.vnode.data.slot).toBe('slot')
		})

		test('Handles nested properties (camelCase)', async () => {
			const noop = (_: any) => _
			const wrapper: any = shallowMount(
				await getComponent(
					`{
			  render(h) {
				return (
				  <div propsOnSuccess={noop} onClick={noop} onCamelCase={noop} domPropsInnerHTML="<p>hi</p>" hookInsert={noop} />
				)
			  },
			}`,
					{ noop }
				)
			)
			expect(wrapper.vnode.data.props.onSuccess).toBe(noop)
			expect(wrapper.vnode.data.on.click.fns).toBe(noop)
			expect(wrapper.vnode.data.on.camelCase.fns).toBe(noop)
			expect(wrapper.vnode.data.domProps.innerHTML).toBe('<p>hi</p>')
			expect(wrapper.vnode.data.hook.insert).toBe(noop)
		})

		test('Supports data attribute', async () => {
			const wrapper: any = shallowMount(
				await getComponent(`{
			  render(h) {
				return <div data-id="1" />
			  },
			}`)
			)

			expect(wrapper.vnode.data.attrs['data-id']).toBe('1')
		})

		test('Handles identifier tag name as components', async () => {
			const Test = { render: () => null }
			const wrapper: any = shallowMount(
				await getComponent(
					`{
			  render(h) {
				return <Test />
			  },
			}`,
					{ Test }
				)
			)

			expect(wrapper.vnode.tag).toMatch(/^vue-component/)
		})

		test('Works for components with children', async () => {
			const Test = {
				render(h: (b: string) => any) {
					h('div')
				}
			}
			const wrapper: any = shallowMount(
				await getComponent(
					`{
				render(h) {
					return (
						<Test>
							<div>hi</div>
						</Test>
					)
				}
			}`,
					{ Test }
				)
			)
			const children = wrapper.vnode.componentOptions.children
			expect(children[0].tag).toBe('div')
		})

		test('Binds things in thunk with correct this context', async () => {
			const Test = await getComponent(`{
				render(h) {
					return <div>{this.$slots.default}</div>
				}
			}`)
			const wrapper: any = mount(
				await getComponent(
					`{
			  data: () => ({ test: 'foo' }),
			  render(h) {
				return <Test>{this.test}</Test>
			  },
			}`,
					{ Test }
				)
			)

			expect(wrapper.html()).toBe('<div>foo</div>')
		})

		test('Spread (single object expression)', async () => {
			const props = {
				hello: 2
			}
			const wrapper: any = shallowMount(
				await getComponent(
					`{
			  render(h) {
				return <div {... { props } } />
			  },
			}`,
					{ props }
				)
			)

			expect(wrapper.vnode.data.props).toMatchObject(props)
		})

		test('Spread (mixed)', async () => {
			const calls: number[] = []
			const data = {
				attrs: {
					id: 'hehe'
				},
				on: {
					click() {
						calls.push(3)
					}
				},
				props: {
					innerHTML: 2
				},
				hook: {
					insert() {
						calls.push(1)
					}
				},
				class: ['a', 'b']
			}
			const wrapper: any = shallowMount(
				await getComponent(
					`{
			  render(h) {
				return (
				  <div
					href="huhu"
					{...data}
					class={{ c: true }}
					on-click={() => calls.push(4)}
					hook-insert={() => calls.push(2)}
				  />
				)
			  },
			}`,
					{ data, calls }
				)
			)

			expect(wrapper.vnode.data.attrs).toMatchObject({ id: 'hehe', href: 'huhu' })
			expect(wrapper.vnode.data.props.innerHTML).toBe(2)
			expect(wrapper.vnode.data.class).toEqual(['a', 'b', { c: true }])
			// expect(calls).toEqual([1, 2])
			wrapper.vnode.data.on.click()
			expect(calls).toEqual([1, 2, 3, 4])
		})

		test('Custom directives', async () => {
			const directive = {
				inserted() {}
			}
			Vue.directive('test', directive)
			Vue.directive('other', directive)

			const wrapper: any = shallowMount(
				await getComponent(
					`{
				render(h) {
					return <div v-test={123} vOther={234} />
				}
			}`
				)
			)

			expect(wrapper.vnode.data.directives.length).toBe(2)
			expect(wrapper.vnode.data.directives[0]).toEqual({
				def: directive,
				modifiers: {},
				name: 'test',
				value: 123
			})
			expect(wrapper.vnode.data.directives[1]).toEqual({
				def: directive,
				modifiers: {},
				name: 'other',
				value: 234
			})
		})

		test('xlink:href', async () => {
			const wrapper: any = shallowMount(
				await getComponent(
					`{
			  render(h) {
				return <use xlinkHref={'#name'} />
			  },
			}`
				)
			)

			expect(wrapper.vnode.data.attrs['xlink:href']).toBe('#name')
		})
		test('Merge class', async () => {
			const wrapper: any = shallowMount(
				await getComponent(
					`{
				render(h) {
					return <div class="a" {...{ class: 'b' }} />
				}
			}`
				)
			)

			expect(wrapper.vnode.data.class).toEqual(['a', 'b'])
		})

		test('JSXMemberExpression', async () => {
			const a = {
				b: {
					cmp: await getComponent(
						`{
						render(h) {
							return <div />
						}
					}`
					)
				}
			}
			const wrapper: any = mount(
				await getComponent(
					`{
			  render(h) {
				return <a.b.cmp />
			  },
			}`,
					{ a }
				)
			)

			expect(wrapper.html()).toBe('<div></div>')
		})
	})
})
