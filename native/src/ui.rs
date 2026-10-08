use crate::catalog::Catalog;
use crate::catalog::EntryId;
use egui::{Color32, RichText};
use std::path::PathBuf;
use ts4_mod_manager_core::path_detection::GameInstance;

fastframe_icons::icons! {
    pub enum Icon {
        prefix: "ts4-native-",
        directory: ".",
        Search => lucide "search",
        Refresh => lucide "refresh-cw",
        Moon => lucide "moon",
        Sun => lucide "sun",
        Back => lucide "arrow-left",
        Copy => lucide "copy",
    }
}

pub fn setup(ctx: &egui::Context) {
    egui_extras::install_image_loaders(ctx);
    fastframe_icons::install::<Icon>(ctx);
    let mut fonts = fastframe_fonts::FontSetup::default().definitions();
    let rendering = fastframe_text::detect();
    rendering.apply_to(&mut fonts);
    ctx.set_fonts(fonts);
    ctx.all_styles_mut(|style| {
        let dark = style.visuals.dark_mode;
        style.visuals.panel_fill = if dark {
            Color32::from_rgb(21, 23, 28)
        } else {
            Color32::from_rgb(248, 250, 252)
        };
        style.visuals.extreme_bg_color = if dark {
            Color32::from_rgb(17, 24, 39)
        } else {
            Color32::WHITE
        };
        style.visuals.override_text_color = Some(if dark {
            Color32::from_rgb(248, 250, 252)
        } else {
            Color32::from_rgb(2, 6, 23)
        });
        style.visuals.selection.bg_fill = if dark {
            Color32::from_rgb(10, 70, 54)
        } else {
            Color32::from_rgb(209, 250, 229)
        };
        style.visuals.selection.stroke.color = if dark {
            Color32::from_rgb(110, 231, 183)
        } else {
            Color32::from_rgb(6, 95, 70)
        };
        style.spacing.item_spacing = egui::vec2(10.0, 8.0);
        style.spacing.button_padding = egui::vec2(12.0, 8.0);
        rendering.apply_to_visuals(&mut style.visuals);
    });
}

#[derive(Default)]
pub struct View {
    pub root_input: String,
    pub instances: Vec<GameInstance>,
    pub scan_ms: Option<f64>,
    pub stats: RenderStats,
    detail_only: bool,
}

#[derive(Default)]
pub struct RenderStats {
    pub rows: usize,
    pub files: usize,
    pub search: Option<egui::Rect>,
    pub first_row: Option<egui::Rect>,
}

impl View {
    pub fn show(&mut self, ui: &mut egui::Ui, catalog: &mut Catalog) -> Option<PathBuf> {
        self.stats = RenderStats::default();
        let mut scan_root = None;
        let narrow = ui.available_width() < 900.0;
        let foreground = ui.visuals().text_color();
        egui::Panel::top("catalog-header")
            .resizable(false)
            .frame(
                egui::Frame::new()
                    .fill(ui.visuals().panel_fill)
                    .inner_margin(20),
            )
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.label(RichText::new("Sims 4 Mod Manager").size(23.0).strong());
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        let dark = ui.visuals().dark_mode;
                        let icon = if dark { Icon::Sun } else { Icon::Moon };
                        let label = if dark { "Light" } else { "Dark" };
                        if ui
                            .add(egui::Button::image_and_text(
                                icon.image(foreground, 16.0),
                                label,
                            ))
                            .clicked()
                        {
                            ui.ctx().set_theme(if dark {
                                egui::Theme::Light
                            } else {
                                egui::Theme::Dark
                            });
                        }
                    });
                });
                ui.add_space(10.0);
                ui.horizontal(|ui| {
                    ui.label("Game folder");
                    let width = (ui.available_width() - 95.0).max(100.0);
                    let response = ui.add(
                        egui::TextEdit::singleline(&mut self.root_input)
                            .hint_text("Folder containing Mods")
                            .desired_width(width),
                    );
                    let enter = response.lost_focus()
                        && ui.input(|input| input.key_pressed(egui::Key::Enter));
                    if ui.button("Open").clicked() || enter {
                        let value = self.root_input.trim();
                        if !value.is_empty() {
                            scan_root = Some(PathBuf::from(value));
                        }
                    }
                });
                if !self.instances.is_empty() {
                    egui::ComboBox::from_id_salt("instances")
                        .selected_text("Detected game folders")
                        .show_ui(ui, |ui| {
                            for instance in &self.instances {
                                let label = instance.path.to_string_lossy();
                                if ui
                                    .selectable_label(
                                        catalog.root.as_ref() == Some(&instance.path),
                                        label.as_ref(),
                                    )
                                    .clicked()
                                {
                                    self.root_input = label.into_owned();
                                    scan_root = Some(instance.path.clone());
                                }
                            }
                        });
                }
            });

        egui::Panel::bottom("catalog-status")
            .resizable(false)
            .frame(
                egui::Frame::new()
                    .fill(ui.visuals().panel_fill)
                    .inner_margin(12),
            )
            .show(ui, |ui| {
                ui.horizontal_wrapped(|ui| {
                    ui.small("Read-only pilot");
                    ui.separator();
                    if catalog.loading {
                        ui.spinner();
                        ui.small("Scanning your Mods folder...");
                    } else if let Some(ms) = self.scan_ms {
                        ui.small(format!(
                            "{} mods · scanned in {ms:.0} ms",
                            catalog.mods.len()
                        ));
                    } else {
                        ui.small("Choose a game folder to browse your mods.");
                    }
                });
            });

        if !narrow {
            egui::Panel::right("mod-details")
                .default_size(360.0)
                .min_size(280.0)
                .max_size(480.0)
                .frame(
                    egui::Frame::new()
                        .fill(ui.visuals().extreme_bg_color)
                        .inner_margin(24),
                )
                .show(ui, |ui| {
                    self.details(ui, catalog);
                });
        }

        egui::CentralPanel::default().frame(egui::Frame::new().fill(ui.visuals().panel_fill).inner_margin(24))
            .show(ui, |ui| {
                if let Some(error) = &catalog.error {
                    ui.colored_label(ui.visuals().error_fg_color, error);
                    ui.label("Check that the game folder exists and contains a readable Mods folder, then open it again.");
                    ui.add_space(16.0);
                }
                if narrow && self.detail_only && catalog.selected_mod().is_some() {
                    if ui.add(egui::Button::image_and_text(Icon::Back.image(foreground, 16.0), "Back to mods")).clicked() {
                        self.detail_only = false;
                    }
                    ui.add_space(16.0);
                    self.details(ui, catalog);
                    return;
                }
                ui.horizontal(|ui| {
                    ui.heading("Your mods");
                    ui.label(format!("{}", catalog.mods.len()));
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if ui.add_enabled(catalog.root.is_some() && !catalog.loading,
                            egui::Button::image_and_text(Icon::Refresh.image(foreground, 16.0), "Rescan")).clicked() {
                            scan_root = catalog.root.clone();
                        }
                    });
                });
                ui.add_space(12.0);
                ui.horizontal(|ui| {
                    ui.add(Icon::Search.image(foreground, 18.0));
                    let mut query = catalog.query.clone();
                    let response = ui.add(egui::TextEdit::singleline(&mut query)
                        .hint_text("Search mods or filenames") .desired_width(ui.available_width()));
                    self.stats.search = Some(response.rect);
                    if response.changed() { catalog.search(query); }
                });
                ui.add_space(12.0);
                if !catalog.query.is_empty() { ui.small(format!("{} matching mods", catalog.visible.len())); }
                if catalog.visible.is_empty() {
                    ui.add_space(32.0);
                    let (title, message) = if catalog.loading {
                        ("Reading your catalog", "You can keep using the window while the scan runs.")
                    } else if catalog.root.is_none() {
                        ("Start with your game folder", "Open the Sims 4 folder containing Mods, or choose a detected game folder above.")
                    } else if !catalog.query.is_empty() {
                        ("No matching mods", "Try another name or filename, or clear your search.")
                    } else {
                        ("No mods found", "This folder has no package or script mods. Managed mods also appear here when stored locally.")
                    };
                    ui.heading(title); ui.label(message);
                    return;
                }
                let root_id = catalog.root.clone();
                egui::ScrollArea::vertical().id_salt(("catalog", root_id)).auto_shrink([false, false])
                    .show_rows(ui, 62.0, catalog.visible.len(), |ui, range| {
                        for visible_index in range {
                            let index = catalog.visible[visible_index];
                            let entry = &catalog.mods[index];
                            let identity = EntryId::of(entry);
                            let origin = match entry.source {
                                ts4_mod_manager_core::mod_scan::ModSource::Managed => "Managed",
                                ts4_mod_manager_core::mod_scan::ModSource::External => "External",
                            };
                            let state = if entry.enabled { "Installed" } else { "Stored" };
                            let subtitle = format!("{origin} · {state} · {} mod files", entry.mod_files.len());
                            let selected = catalog.selected.as_ref() == Some(&identity);
                            let response = ui.push_id(identity, |ui| {
                                let (rect, response) = ui.allocate_exact_size(egui::vec2(ui.available_width(), 62.0), egui::Sense::click());
                                let visuals = ui.style().interact_selectable(&response, selected);
                                if selected || response.hovered() || response.has_focus() {
                                    ui.painter().rect_filled(rect, 6.0, visuals.bg_fill);
                                }
                                let mut row = ui.new_child(egui::UiBuilder::new().max_rect(rect.shrink2(egui::vec2(12.0, 8.0))).layout(egui::Layout::top_down(egui::Align::Min)));
                                row.spacing_mut().item_spacing.y = 4.0;
                                row.add(egui::Label::new(RichText::new(&entry.name).size(16.0).color(foreground)).truncate());
                                row.add(egui::Label::new(RichText::new(subtitle).size(12.0).color(ui.visuals().weak_text_color())).truncate());
                                response.widget_info(|| egui::WidgetInfo::selected(egui::WidgetType::SelectableLabel, ui.is_enabled(), selected, &entry.name));
                                response.on_hover_text(&entry.name)
                            }).inner;
                            if self.stats.first_row.is_none() { self.stats.first_row = Some(response.rect); }
                            self.stats.rows += 1;
                            if response.clicked() {
                                catalog.select(index);
                                self.detail_only = narrow;
                            }
                        }
                    });
            });
        scan_root
    }

    fn details(&mut self, ui: &mut egui::Ui, catalog: &Catalog) {
        let Some(entry) = catalog.selected_mod() else {
            ui.add_space(24.0);
            ui.heading("Select a mod");
            ui.label("Its files and saved source details will appear here.");
            return;
        };
        ui.add(egui::Label::new(RichText::new(&entry.name).size(21.0).strong()).wrap());
        ui.add_space(8.0);
        ui.label(if entry.enabled {
            "Installed in this game folder"
        } else {
            "Stored in managed storage"
        });
        ui.add_space(16.0);
        if let Some(source) = &entry.source_url {
            ui.strong("Saved source");
            ui.add(egui::Label::new(source).selectable(true).wrap());
            if let Some(attachment) = &entry.source_attachment {
                if let Some(author) = &attachment.author {
                    ui.label(author);
                }
                if attachment
                    .confidence
                    .is_some_and(|confidence| confidence < 70)
                {
                    ui.label("Low confidence. Verify this source before relying on it.");
                }
            }
            ui.add_space(16.0);
        }
        ui.separator();
        ui.horizontal(|ui| {
            ui.strong(format!("Files ({})", entry.files.len()));
            if ui
                .add(egui::Button::image_and_text(
                    Icon::Copy.image(ui.visuals().text_color(), 14.0),
                    "Copy",
                ))
                .clicked()
            {
                ui.ctx().copy_text(entry.files.join("\n"));
            }
        });
        let identity = EntryId::of(entry);
        egui::ScrollArea::vertical()
            .id_salt(("files", catalog.root.clone(), identity))
            .auto_shrink([false, false])
            .show_rows(ui, 24.0, entry.files.len(), |ui, range| {
                for index in range {
                    ui.add_sized(
                        [ui.available_width(), 24.0],
                        egui::Label::new(&entry.files[index])
                            .truncate()
                            .selectable(true),
                    )
                    .on_hover_text(&entry.files[index]);
                    self.stats.files += 1;
                }
            });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn populated_catalog() -> Catalog {
        let entries = (0..10_000).map(|index| serde_json::from_value(serde_json::json!({
            "key": format!("Mod{index:05}"), "name": format!("Mod{index:05}"),
            "files": (0..if index == 0 { 10_000 } else { 1 }).map(|n| format!("file{n}.package")).collect::<Vec<_>>(),
            "mod_files": ["file0.package"], "source": "external", "enabled": true, "group_path": ["Pack"]
        })).expect("entry")).collect();
        let mut catalog = Catalog::default();
        let generation = catalog.begin_scan("/fixture/The Sims 4".into());
        catalog.accept_scan(generation, Ok(entries));
        catalog.select(0);
        catalog
    }

    fn render(
        ctx: &egui::Context,
        view: &mut View,
        catalog: &mut Catalog,
        events: Vec<egui::Event>,
        width: f32,
    ) {
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::vec2(width, 800.0),
            )),
            events,
            ..Default::default()
        };
        let mut output = ctx.run_ui(input, |ui| {
            view.show(ui, catalog);
        });
        output.textures_delta.clear();
    }

    #[test]
    fn large_catalog_and_file_details_only_render_visible_rows() {
        let mut catalog = populated_catalog();
        let mut view = View::default();
        let ctx = egui::Context::default();
        render(&ctx, &mut view, &mut catalog, vec![], 1200.0);
        render(&ctx, &mut view, &mut catalog, vec![], 1200.0);
        assert!(view.stats.rows > 0 && view.stats.rows < 30);
        assert!(view.stats.files > 0 && view.stats.files < 40);
        render(&ctx, &mut view, &mut catalog, vec![], 680.0);
        assert!(view.stats.rows < 30);
    }

    #[test]
    fn real_search_widget_filters_catalog_after_keyboard_input() {
        let mut catalog = populated_catalog();
        let mut view = View::default();
        let ctx = egui::Context::default();
        render(&ctx, &mut view, &mut catalog, vec![], 1200.0);
        render(&ctx, &mut view, &mut catalog, vec![], 1200.0);
        let pos = view.stats.search.expect("search").center();
        render(
            &ctx,
            &mut view,
            &mut catalog,
            vec![
                egui::Event::PointerMoved(pos),
                egui::Event::PointerButton {
                    pos,
                    button: egui::PointerButton::Primary,
                    pressed: true,
                    modifiers: Default::default(),
                },
                egui::Event::PointerButton {
                    pos,
                    button: egui::PointerButton::Primary,
                    pressed: false,
                    modifiers: Default::default(),
                },
            ],
            1200.0,
        );
        render(
            &ctx,
            &mut view,
            &mut catalog,
            vec![egui::Event::Text("Mod00042".into())],
            1200.0,
        );
        assert_eq!(catalog.visible.len(), 1);
        assert_eq!(catalog.mods[catalog.visible[0]].name, "Mod00042");
    }
}
