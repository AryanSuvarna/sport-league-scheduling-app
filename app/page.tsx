"use client";

import { AvailabilityFormCard } from "./venue-availability/components/AvailabilityFormCard";
import { AvailabilityList } from "./venue-availability/components/AvailabilityList";
import { FieldModal } from "./venue-availability/components/FieldModal";
import { PageHeader } from "./venue-availability/components/PageHeader";
import { VenueModal } from "./venue-availability/components/VenueModal";
import { useVenueAvailability } from "./venue-availability/useVenueAvailability";

export default function Home() {
  const venueAvailability = useVenueAvailability();

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#1b241f]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader onFinalSubmit={venueAvailability.finalSubmit} />

        <section className="grid min-h-0 items-stretch gap-6 lg:grid-cols-[minmax(360px,460px)_1fr]">
          <AvailabilityFormCard
            form={venueAvailability.form}
            formRef={venueAvailability.formRef}
            isEditing={venueAvailability.isEditing}
            isSaving={venueAvailability.isSaving}
            message={venueAvailability.message}
            recurringSummary={venueAvailability.recurringSummary}
            selectedVenue={venueAvailability.selectedVenue}
            selectedVenueFields={venueAvailability.selectedVenueFields}
            selectedFieldId={venueAvailability.selectedFieldId}
            matchingVenues={venueAvailability.matchingVenues}
            hasExactVenueMatch={venueAvailability.hasExactVenueMatch}
            onSubmit={venueAvailability.handleSubmit}
            onReset={venueAvailability.resetForm}
            onUpdateField={venueAvailability.updateField}
            onSetForm={venueAvailability.setForm}
            onSelectVenue={venueAvailability.selectVenue}
            onOpenAddVenue={venueAvailability.openAddVenueModal}
            onOpenEditVenue={venueAvailability.openEditVenueModal}
            onOpenAddField={() => venueAvailability.setIsFieldModalOpen(true)}
          />

          <AvailabilityList
            availabilities={venueAvailability.sortedAvailabilities}
            overlapIds={venueAvailability.overlapIds}
            isLoading={venueAvailability.isLoading}
            panelStyle={venueAvailability.availabilityPanelStyle}
            onEdit={venueAvailability.editAvailability}
            onDelete={venueAvailability.deleteAvailability}
          />
        </section>
      </div>

      {venueAvailability.isVenueModalOpen ? (
        <VenueModal
          form={venueAvailability.newVenueForm}
          isEditing={venueAvailability.editingVenueId !== null}
          isSaving={venueAvailability.isAddingVenue}
          onChange={venueAvailability.setNewVenueForm}
          onClose={venueAvailability.closeVenueModal}
          onSubmit={
            venueAvailability.editingVenueId
              ? venueAvailability.updateVenue
              : venueAvailability.addVenue
          }
        />
      ) : null}

      {venueAvailability.isFieldModalOpen ? (
        <FieldModal
          label={venueAvailability.newFieldLabel}
          selectedVenue={venueAvailability.selectedVenue}
          isSaving={venueAvailability.isAddingField}
          onChange={venueAvailability.setNewFieldLabel}
          onClose={() => venueAvailability.setIsFieldModalOpen(false)}
          onSubmit={venueAvailability.addField}
        />
      ) : null}
    </main>
  );
}
