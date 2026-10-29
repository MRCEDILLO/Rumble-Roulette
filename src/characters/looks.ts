export interface ColorOption {
  id: string;
  name: string;
  main: string;
  shade: string;
}

export const COLORS: ColorOption[] = [
  { id: 'red', name: 'Red', main: '#e5383b', shade: '#9d0208' },
  { id: 'orange', name: 'Orange', main: '#ff8c2b', shade: '#c25e00' },
  { id: 'yellow', name: 'Yellow', main: '#ffd23f', shade: '#c99a00' },
  { id: 'lime', name: 'Lime', main: '#8ee04a', shade: '#4f9a1a' },
  { id: 'green', name: 'Green', main: '#1f9d55', shade: '#0b6534' },
  { id: 'cyan', name: 'Cyan', main: '#3ee0e0', shade: '#1a9a9e' },
  { id: 'blue', name: 'Blue', main: '#2f5bea', shade: '#1a3399' },
  { id: 'purple', name: 'Purple', main: '#8f4de8', shade: '#5a23a6' },
  { id: 'pink', name: 'Pink', main: '#ff6fb5', shade: '#c63d83' },
  { id: 'brown', name: 'Brown', main: '#8a5a3b', shade: '#5a3420' },
  { id: 'white', name: 'White', main: '#f2f2f5', shade: '#a9acc0' },
  { id: 'black', name: 'Black', main: '#3b3d4a', shade: '#1c1d24' },
];

export const ACCESSORIES = [
  { id: 'none', name: 'None' },
  { id: 'party', name: 'Party hat' },
  { id: 'crown', name: 'Crown' },
  { id: 'cap', name: 'Cap' },
  { id: 'beanie', name: 'Beanie' },
  { id: 'headphones', name: 'Headphones' },
  { id: 'bow', name: 'Bow' },
  { id: 'chef', name: 'Chef hat' },
  { id: 'halo', name: 'Halo' },
  { id: 'tophat', name: 'Top hat' },
  { id: 'fedora', name: 'Fedora' },
  { id: 'shades', name: 'Shades' },
  { id: 'sombrero', name: 'Sombrero' },
  { id: 'banana', name: 'Banana peel' },
] as const;

export const colorById = (id: string): ColorOption => COLORS.find((c) => c.id === id) ?? COLORS[0];
